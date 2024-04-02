import dotenv from "dotenv";
import ldap from "./ldap.mjs";

dotenv.config();

const client = await ldap.openLdap(
    process.env.LDAP_SERVER,
    process.env.LDAP_BASE_DN,
    process.env.LDAP_BIND_DN,
    process.env.LDAP_BIND_PASSWORD
);

await ldap.removeLdapEntry(
    client,
    process.env.TEST_DN
);

await ldap.removeLdapEntry(
    client,
    process.env.TEST_MOVE_DN
);

const result = await ldap.queryLdap(
    client,
    process.env.TEST_SEARCH_FILTER
);

for (const entry of result) {
    for (const attribute of entry) {
        console.log(attribute.type, attribute.values);
    }
}


await ldap.addLdapEntry(
    client,
    process.env.TEST_DN,
    {
        cn: "test_account",
        sn: "Account",
        telephoneNumber: "0120-123-456",
        mail: "test_account@test.domain",
        objectClass: ["top", "inetOrgPerson",]
    }
);

await ldap.setLdapAttribute(
    client,
    process.env.TEST_DN,
    process.env.TEST_ATTR_NAME,
    [process.env.TEST_ATTR_VALUE]
);

await ldap.addLdapAttribute(
    client,
    process.env.TEST_DN,
    process.env.TEST_ATTR_NAME,
    ["0120-444-444", "0120-555-555"]
);

await ldap.removeLdapAttribute(
    client,
    process.env.TEST_DN,
    process.env.TEST_ATTR_NAME
);

await ldap.moveLdapEntry(
    client,
    process.env.TEST_DN,
    process.env.TEST_MOVE_DN
);

await ldap.removeLdapEntry(
    client,
    process.env.TEST_MOVE_DN
);

await ldap.closeLdap(client);
