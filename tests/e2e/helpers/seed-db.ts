import data from './seed-firestore.json';
import { db, auth } from './admin-firebase';

const BATCH_LIMIT = 500;

// async function bulkCreate(collectionName: string, dataArray: Array<Record<string, any>>) {
//     if (!dataArray.length) return;

//     const results = { success: 0, failed: 0 };

//     const chunks = [];
//     for (let i = 0; i < dataArray.length; i += BATCH_LIMIT) {
//         chunks.push(dataArray.slice(i, i + BATCH_LIMIT));
//     }

//     for (const [_, chunk] of chunks.entries()) {
//         try {
//             const batch = writeBatch(db);

//             chunk.forEach((data) => {
//                 const docRef = doc(collection(db, collectionName));
//                 batch.set(docRef, {
//                     ...data
//                 });
//             });

//             await batch.commit();
//             results.success += chunk.length;
//         } catch (error) {
//             results.failed += chunk.length;
//         }
//     }

//     return results;
// }

async function bulkCreate(collectionName: string, dataArray: Array<Record<string, any>>) {
    if (!dataArray.length) return;

    const results = { success: 0, failed: 0 };

    const chunks = [];
    for (let i = 0; i < dataArray.length; i += BATCH_LIMIT) {
        chunks.push(dataArray.slice(i, i + BATCH_LIMIT));
    }

    for (const [_, chunk] of chunks.entries()) {
        try {
            const batch = db.batch();

            // chunk.forEach((data) => {
            //     const docRef = doc(collection(db, collectionName));
            //     batch.set(docRef, {
            //         ...data
            //     });
            // });

            chunk.forEach((data, index) => {
                const docRef = db.collection(collectionName).doc(`${collectionName}-${index}`)
                batch.set(docRef, { ...data })
            })

            await batch.commit();
            results.success += chunk.length;
        } catch (error) {
            results.failed += chunk.length;
        }
    }

    return results;
}

export async function seedDatabase() {

    // const FIRESTORE_EMULATOR_PORT = (config.emulators as Emulator)?.firestore?.port || 8080;
    // const FIRESTORE_EMULATOR_HOST = (config.emulators as Emulator)?.firestore?.host || `localhost`;

    // connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
    // const db = getApp()

    for (const [key, value] of Object.entries(data)) {
        await bulkCreate(key, value);
    }
}

export async function addUser(userData: { email: string; password: string }) {

    await auth.createUser(userData);


    // const AUTH_EMULATOR = (config.emulators as Emulator)?.auth;
    // const AUTH_EMULATOR_HOST = AUTH_EMULATOR?.host || 'localhost'
    // const AUTH_EMULATOR_PORT = AUTH_EMULATOR?.port || 9099;

    // // connectFirestoreEmulator(db, AUTH_EMULATOR_HOST, AUTH_EMULATOR_PORT);

    // const projectId = db.app.options.projectId

    // const AUTH_EMULATOR_URL = `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`;

    // const clearResponse = await fetch(
    //     `${AUTH_EMULATOR_URL}/emulator/v1/projects/${projectId}/accounts`,
    //     { method: 'DELETE' }
    // );

    // if (!clearResponse.ok) {
    //     console.warn(
    //         `[global-setup] Warning: Failed to clear emulator accounts (${clearResponse.status}). Proceeding anyway.`
    //     );
    // }

    // // Create the test user via the Auth Emulator REST API
    // const signUpResponse = await fetch(
    //     `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    //     {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify({
    //             email: username,
    //             password,
    //             returnSecureToken: true,
    //         }),
    //     }
    // );

    // if (!signUpResponse.ok) {
    //     const body = await signUpResponse.text();
    //     throw new Error(
    //         `[global-setup] Failed to create test user in emulator: ${signUpResponse.status} — ${body}`
    //     );
    // }

    // console.log(`[global-setup] Test user created: ${username}`);
}
