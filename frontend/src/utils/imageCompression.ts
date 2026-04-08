export const compressImage = async (file: File, maxWidth: number, quality: number): Promise<File> => {
    console.log('Mock compression:', file.name, { maxWidth, quality });
    return Promise.resolve(file); // Just return the original file to mock compression
};
