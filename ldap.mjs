import dotenv from 'dotenv';
import ldap from 'ldapjs';

dotenv.config();

/**
 * ldapに接続する
 * @param {*} url サーバのURL
 * @param {*} bindDn バインドに使用するDN
 * @param {*} password バインドに使用するパスワード
 * @returns client
 */
async function openLdap(url, baseDn, bindDn, password) {
    const client = ldap.createClient({ url: url });
    client.bind(bindDn, password, (err) => {
        if (err) {
            throw new Error(err);
        }
    });
    client.baseDn = baseDn;
    return client;
}

/**
 * ldapとの接続を切断する
 * @param {*} client 
 */
async function closeLdap(client) {
    client.unbind((err) => {
        if (err) throw new Error(err);
    });
}

/**
 * ldapのノードを検索する 
 * @param {*} client 
 * @param {*} searchDn 
 * @param {*} searchFilter 
 * @param {*} scope 
 * @returns 
 */
async function searchLdap(client, searchDn, searchFilter, scope) {
    return new Promise((resolve, reject) => {

        const opts = {
            filter: searchFilter,
            scope: scope
        };

        client.search(searchDn, opts, (err, res) => {
            if (err) {
                reject(err);
            } else {
                const results = [];

                res.on('searchEntry', (entry) => {
                    results.push(entry.attributes);
                });

                res.on('end', () => {
                    resolve(results);
                });

                res.on('error', (err) => {
                    if (err.lde_message === 'No Such Object') {
                        resolve([]);
                    } else {
                        reject(err);
                    }
                });
            }
        });
    });
}

/**
 * ldapのノードを検索する
 * @param {*} client 
 * @param {*} searchFilter 
 * @returns 
 */
async function queryLdap(client, searchFilter) {
    return await searchLdap(client, client.baseDn, searchFilter, 'sub');
}

/**
 * 指定したldapのノードにAttributeを登録する
 * @param {*} client
 * @param {*} dn
 * @param {*} change
 */
async function changeLdapAttribute(client, dn, change) {

    if (await isExistEntry(client, dn)) {

        if (client === undefined || client === null) {
            throw new Error('client is not defined');
        }

        return new Promise((resolve, reject) => {
            client.modify(dn, change, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    } else {
        return;
    }
}

/**
 * ldapのノードにAttributeを設定する
 * @param {*} client 
 * @param {*} dn 
 * @param {*} attributeName 
 * @param {*} attributeValues 
 * @returns 
 */
async function setLdapAttribute(client, dn, attributeName, attributeValues) {
    const change = await getChange('replace', attributeName, attributeValues);
    return await changeLdapAttribute(client, dn, change);
}

/**
 * ldapのノードにAttributeを追加する
 * @param {*} client 
 * @param {*} dn 
 * @param {*} attributeName 
 * @param {*} attributeValues 
 * @returns 
 */
async function addLdapAttribute(client, dn, attributeName, attributeValues) {
    const change = await getChange('add', attributeName, attributeValues);
    return await changeLdapAttribute(client, dn, change);
}

/**
 * ldapのノードからAttributeを削除する
 * @param {*} client 
 * @param {*} dn 
 * @param {*} attributeName 
 * @returns 
 */
async function removeLdapAttribute(client, dn, attributeName) {
    const change = await getChange('delete', attributeName, []);
    return await changeLdapAttribute(client, dn, change);
}

/**
 * 変更内容をペイロードに格納し、取得する。
 * @param {*} operation 
 * @param {*} attributeName 
 * @param {*} attributeValues 
 * @returns 
 */
async function getChange(operation, attributeName, attributeValues) {
    return new ldap.Change({
        operation: operation,
        modification: new ldap.Attribute({
            type: attributeName,
            values: attributeValues
        })
    })

}

/**
 * LDAPサーバーに新しいエントリを追加する
 * @param {*} client LDAPクライアントオブジェクト
 * @param {*} dn 新しいエントリの識別名（Distinguished Name）
 * @param {*} entry 新しいエントリの属性を含むオブジェクト(JSON形式)
 * @returns Promise
 */
async function addLdapEntry(client, targetDn, dnEntry) {
    if (!await isExistEntry(client, targetDn)) {
        return new Promise((resolve, reject) => {
            client.add(targetDn, dnEntry, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    } else {
        throw new Error(`entry ${entry} is already exist`);
    }
}

/**
 * LDAPエントリを削除する
 * @param {*} client LDAPクライアントオブジェクト
 * @param {*} dn 削除するエントリの識別名（Distinguished Name）
 * @returns Promise
 */
async function removeLdapEntry(client, dn) {
    if (await isExistEntry(client, dn)) {
        return new Promise((resolve, reject) => {
            client.del(dn, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

/**
 * LDAPエントリのDistinguished Name（DN）を変更する
 * @param {*} client LDAPクライアントオブジェクト
 * @param {*} oldDn 変更前のDN
 * @param {*} newDn 変更後のDN
 * @returns Promise
 */
async function moveLdapEntry(client, oldDn, newDn) {
    if (await isExistEntry(client, oldDn) && !await isExistEntryByAttribute(client, newDn)) {
        return new Promise((resolve, reject) => {

            client.modifyDN(oldDn, newDn, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    } else {
        throw new Error('oldDn is not exist or newDn is exist');
    }
}

/**
 * 指定したDNのエントリが存在するかどうかを確認する 
 * @param {*} client 
 * @param {*} askDn 
 * @returns 
 */
async function isExistEntryByAttribute(client, askDn = '*') {
    const result = await queryLdap(client, askDn);
    return result.length > 0;
}

async function isExistEntry(client, askDn) {
    const result = await searchLdap(client, askDn, '(objectClass=*)', 'base');
    return result.length > 0;
}

export default {
    addLdapAttribute,
    addLdapEntry,
    changeLdapAttribute,
    closeLdap,
    isExistEntryByAttribute,
    isExistEntry,
    moveLdapEntry,
    openLdap,
    queryLdap,
    removeLdapAttribute,
    removeLdapEntry,
    searchLdap,
    setLdapAttribute
};
