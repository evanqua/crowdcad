import firebaseEmulatorConf from "../../../firebase.json"

type EmulatorConfig = {
    host?: string;
    port?: number;
}

type FirebaseEmulatorConfig = {
    emulators?: {
        firestore?: EmulatorConfig,
        auth?: EmulatorConfig;
        storage?: EmulatorConfig,
        [_: string]: any
    }
};

const DEFAULT_PORTS: Record<"storage" | "firestore" | "auth", number> = {
    firestore: 8080,
    auth: 9099,
    storage: 9199,
};


export function getConfig(type: "storage" | "firestore" | "auth"): { fqdn: string, host: string, port: number } {
    const { emulators }: FirebaseEmulatorConfig = firebaseEmulatorConf

    const emulator = emulators?.[type];
    const host = emulator?.host ?? 'localhost';
    const port = emulator?.port ?? DEFAULT_PORTS[type];

    return {
        fqdn: `http://${host}:${port}`,
        host,
        port
    }
}