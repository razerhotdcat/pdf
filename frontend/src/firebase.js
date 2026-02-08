/**
 * Firebase 초기화 및 인증
 * 아래 설정에 키만 넣으면 바로 작동합니다.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDhCyY7ZOxkWIwxT85-DRUgUz_NX0Q9k78',
  authDomain: 'pdf-generator-c98a7.firebaseapp.com',
  projectId: 'pdf-generator-c98a7',
  storageBucket: 'pdf-generator-c98a7.firebasestorage.app',
  messagingSenderId: '927922199663',
  appId: '1:927922199663:web:2ca5c5d19fc8e275d9c19a',
};

let app = null;
let auth = null;

if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (err) {
    console.warn('Firebase 초기화 실패:', err);
  }
}

/**
 * 구글 로그인 (팝업)
 * Firebase 설정이 완료된 경우에만 동작합니다.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signInWithGoogle() {
  if (!auth) {
    throw new Error('Firebase가 설정되지 않았습니다. firebase.js의 firebaseConfig에 키를 입력해 주세요.');
  }
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export { auth };
