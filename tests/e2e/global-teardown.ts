import killPort from 'kill-port';
import { db, auth } from './helpers/admin-firebase';
import { getConfig } from './helpers/read-firebase-emulator-config';


export default async function globalTeardown() {

    // Wipe all users - Max 1000
    const result = await auth.listUsers();
    const uids = result.users.map(user => user.uid);

    if (uids.length) {
        await auth.deleteUsers(uids);
    }

    // Wipe all collections
    const collections = await db.listCollections();
    await Promise.all(collections.map(col => db.recursiveDelete(col)));

    // Kill emulator port
    const { port } = getConfig("firestore")
    await killPort(port);
}