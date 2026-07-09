import { dbService } from "@/lib/services";
import { useState, useEffect } from "react";

export default function useListCollection<T>(collectionName: string): { data: T[]; loading: boolean; error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const listData = async (collectionName: string): Promise<void> => {
            try {
                const snapshots = await dbService.getCollection<T>(collectionName);

                setData(snapshots.filter((snap) => snap.data !== null).map((snap) => snap.data as T));
            } catch (err) {
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        }
        listData(collectionName)
    }, [collectionName]);

    return { data, loading, error };
}
