import { db } from "@/app/firebase";
import { collection, DocumentData, getDocs } from "firebase/firestore";
import { useState, useEffect } from "react";

export default <T extends DocumentData>(collectionName: string): { data: T[]; loading: boolean; error: Error | null } => {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const listData = async (collectionName: string): Promise<void> => {
            try {
                const data: T[] = [];

                const querySnapshot = await getDocs(collection(db, collectionName));

                querySnapshot.forEach((doc) => {
                    data.push(doc.data() as T);
                });

                setData(data);
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