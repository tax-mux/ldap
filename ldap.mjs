import dotenv from 'dotenv';
import ldap from 'ldapjs';

dotenv.config();

/**
 * ldapに接続する
 * @param {*} url サーバのURL
 * @param {*} bind_dn バインドに使用するDN
 * @param {*} password バインドに使用するパスワード
 * @returns client
 */
async function openLdap(url, bind_dn, password) {
    const client = ldap.createClient({ url: url });
    client.bind(bind_dn, password, (err) => {
        if (err) {
            throw new Error(err);
        }
    });
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
 * @param {*} searchBase 
 * @param {*} searchFilter 
 * @returns 
 */
async function queryLdap(client, searchBase, searchFilter) {
    if (client === undefined || client === null) {
        throw new Error('client is not defined');
    }

    return new Promise((resolve, reject) => {

        const opts = {
            filter: searchFilter,
            scope: 'sub'
        };

        client.search(searchBase, opts, (err, res) => {
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
                    reject(err);
                });
            }
        });
    }
    );
}

/**
 * 指定したldapのノードにAttributeを登録する
 * @param {*} client
 * @param {*} dn
 * @param {*} change
 */
async function changeLdapAttribute(client, dn, change) {

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

export default{
    addLdapAttribute, closeLdap, openLdap, queryLdap, removeLdapAttribute, setLdapAttribute
};

