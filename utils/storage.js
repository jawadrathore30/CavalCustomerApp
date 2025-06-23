import { storage } from '../firebase.config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Upload an image to Firebase Storage
 * @param {File|Blob} imageFile - The image file to upload
 * @param {string} path - The storage path where the image should be stored
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
export const uploadImage = async (imageFile, path) => {
  try {
    // Create a storage reference
    const storageRef = ref(storage, path);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, imageFile);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Generate a unique path for an image
 * @param {string} userId - The user's ID
 * @param {string} imageName - The original image name
 * @returns {string} - A unique path for the image
 */
export const generateImagePath = (userId, imageName) => {
  const timestamp = Date.now();
  const extension = imageName.split('.').pop();
  return `profile_photos/${userId}_${timestamp}.${extension}`;
}; 