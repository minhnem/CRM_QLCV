import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Kiểm tra xem Firebase đã được cấu hình đủ các biến môi trường cần thiết chưa
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

// Khởi tạo Firebase App an toàn (tránh khởi tạo lại nhiều lần)
const app = isFirebaseConfigured
  ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig))
  : null;

export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();

// Tự động yêu cầu chọn tài khoản Google mỗi lần bấm
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Hàm hỗ trợ Đăng nhập Google Popup qua Firebase
 */
export const signInWithGooglePopup = async () => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error(
      'Firebase chưa được cấu hình. Vui lòng thêm các biến VITE_FIREBASE_* vào file client/.env'
    );
  }

  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();

  return {
    idToken,
    user: {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    },
  };
};
