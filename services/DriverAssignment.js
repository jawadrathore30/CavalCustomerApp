import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../screens/firebase';

/**
 * Updates a ride request with driver information when a driver is assigned
 */
export const assignDriverToRide = async (rideRequestId, driverId) => {
  try {
    // Get driver data from drivers collection
    const driverDoc = await getDoc(doc(db, "drivers", driverId));
    if (!driverDoc.exists()) {
      throw new Error("Driver not found");
    }
    
    const driverData = driverDoc.data();
    
    // Update ride request with driver data
    await updateDoc(doc(db, "rideRequests", rideRequestId), {
      driverId,
      driverName: driverData.firstName + " " + driverData.lastName,
      driverPhoto: driverData.photo,
      driverPhone: driverData.phone,
      status: "assigned",
      assignedAt: new Date()
    });

    return {
      driverId,
      driverName: driverData.firstName + " " + driverData.lastName,
      driverPhoto: driverData.photo,
      driverPhone: driverData.phone
    };
  } catch (error) {
    console.error("Error assigning driver:", error);
    throw error;
  }
};

/**
 * Updates a driver's profile photo
 */
export const updateDriverPhoto = async (driverId, photoUrl) => {
  try {
    await updateDoc(doc(db, "drivers", driverId), {
      photo: photoUrl,
      updatedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error("Error updating driver photo:", error);
    throw error;
  }
}; 