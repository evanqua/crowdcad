export interface IStorageService {
  /** Upload a file to the given path and return its public download URL. */
  uploadFile(path: string, file: File): Promise<string>;

  /** Get the public download URL for an existing file at the given path. */
  getDownloadURL(path: string): Promise<string>;
}
