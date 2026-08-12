import { dbService } from '@/lib/services';

export const DEFAULT_CERTIFICATIONS = ['CPR', 'EMT-B', 'EMT-A', 'EMT-P', 'RN', 'MD/DO'];

const SETTINGS_COLLECTION = 'settings';
const CERTIFICATIONS_KEY = 'certifications';

interface CertificationsDoc {
  key: string;
  list: string[];
}

async function findCertificationsDoc() {
  const docs = await dbService.queryCollection<CertificationsDoc>(SETTINGS_COLLECTION, [
    { field: 'key', op: '==', value: CERTIFICATIONS_KEY },
  ]);
  return docs[0] ?? null;
}

export async function getCertifications(): Promise<string[]> {
  const doc = await findCertificationsDoc();
  if (doc?.data?.list?.length) return doc.data.list;
  return DEFAULT_CERTIFICATIONS;
}

export async function setCertifications(list: string[]): Promise<void> {
  const doc = await findCertificationsDoc();
  if (doc) {
    await dbService.setDocument<CertificationsDoc>(
      SETTINGS_COLLECTION,
      doc.id,
      { key: CERTIFICATIONS_KEY, list },
      { merge: true },
    );
  } else {
    await dbService.addDocument<CertificationsDoc>(SETTINGS_COLLECTION, { key: CERTIFICATIONS_KEY, list });
  }
}
