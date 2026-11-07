import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, testConnection } from '../lib/firebase';
import { UserProfile, UserRole, AccountStatus } from '../types';

export const ADMIN_EMAIL = 'azibabbasi8787@gmail.com';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isStudent: boolean;
  isActive: boolean;
  isBlocked: boolean;
  isRevoked: boolean;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  loginWithEmail: (email: string, pass: string, rememberMe?: boolean) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => setAuthError(null);

  // Test connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  // Listen to Auth State
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!user) {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      const isBootstrappedAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

      // Rule: Google Sign-In is strictly and solely for authorized academy instructors.
      // Any non-admin Google account must be instantly signed out and rejected.
      const isGoogleUser = user.providerData.some((p) => p.providerId === 'google.com');
      if (isGoogleUser && !isBootstrappedAdmin) {
        console.warn('Unauthorized Google login attempted:', user.email);
        await signOut(auth);
        setCurrentUser(null);
        setUserProfile(null);
        setAuthError(
          'Access denied: Google Sign-In is exclusively reserved for the instructor. Students must log in using the email and password provided by the instructor.'
        );
        setLoading(false);
        return;
      }

      // If this is the instructor / administrator
      if (isBootstrappedAdmin) {
        setCurrentUser(user);
        const userDocRef = doc(db, 'users', user.uid);
        const adminDocRef = doc(db, 'admins', user.uid);

        const adminProfile: UserProfile = {
          uid: user.uid,
          email: user.email || ADMIN_EMAIL,
          name: user.displayName || 'Administrator',
          role: 'admin',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Sync admin documents in background
        setDoc(adminDocRef, {
          uid: user.uid,
          email: user.email || ADMIN_EMAIL,
          createdAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
        setDoc(userDocRef, adminProfile, { merge: true }).catch(() => {});

        setUserProfile(adminProfile);
        setLoading(false);
        return;
      }

      // If this is an email/password user, they MUST be registered by the admin in /users/{user.uid}
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(userDocRef);

        if (!snapshot.exists()) {
          console.warn('Unregistered user attempted login:', user.uid, user.email);
          await signOut(auth);
          setCurrentUser(null);
          setUserProfile(null);
          setAuthError(
            'Access denied: This account has not been registered by the administrator. Only enrolled students with admin-issued credentials can access the Zylex Academy portal.'
          );
          setLoading(false);
          return;
        }

        const data = snapshot.data() as UserProfile;

        // Ensure role is valid student
        if (data.role !== 'student') {
          await signOut(auth);
          setCurrentUser(null);
          setUserProfile(null);
          setAuthError('Access denied: Unauthorized role.');
          setLoading(false);
          return;
        }

        // Valid registered student
        setCurrentUser(user);
        setUserProfile(data);
        setLoading(false);

        // Realtime listener for immediate revocation or unblocking while logged in
        unsubscribeProfile = onSnapshot(
          userDocRef,
          (liveSnapshot) => {
            if (liveSnapshot.exists()) {
              const liveData = liveSnapshot.data() as UserProfile;
              setUserProfile(liveData);
            } else {
              // Student document was deleted by admin
              signOut(auth).catch(() => {});
              setCurrentUser(null);
              setUserProfile(null);
              setAuthError('Your student account has been removed by the administrator.');
            }
          },
          (error) => {
            console.error('Profile snapshot error:', error);
          }
        );
      } catch (err) {
        console.error('Auth state initialization error:', err);
        await signOut(auth);
        setCurrentUser(null);
        setUserProfile(null);
        setAuthError('Error verifying student credentials with server.');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const loginWithEmail = async (email: string, pass: string, rememberMe = true) => {
    setAuthError(null);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    } catch {
      // Persistence fallback if blocked
    }
    const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
    const isBootstrappedAdmin = credential.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    // Verify document exists immediately to return direct error if not registered
    if (!isBootstrappedAdmin) {
      const userDocRef = doc(db, 'users', credential.user.uid);
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        await signOut(auth);
        const msg = 'Access denied: This account is not registered by the administrator. Please contact your instructor.';
        setAuthError(msg);
        throw new Error(msg);
      }
    }
  };

  // Handle redirect result (for mobile or browsers where popup is blocked)
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          const email = result.user.email?.toLowerCase();
          if (email !== ADMIN_EMAIL.toLowerCase()) {
            signOut(auth).catch(() => {});
            setAuthError(
              'Access denied: Google Sign-In is exclusively reserved for the instructor. Students must log in using the email and password provided by the instructor.'
            );
          }
        }
      })
      .catch((err: unknown) => {
        console.error('Redirect auth error:', err);
      });
  }, []);

  const loginWithGoogle = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email?.toLowerCase();

      // Strictly enforce admin email
      if (email !== ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        const msg = 'Access denied: Google Sign-In is exclusively reserved for the instructor. Students must log in using the email and password provided by the instructor.';
        setAuthError(msg);
        throw new Error(msg);
      }
    } catch (popupErr: unknown) {
      const code = (popupErr as { code?: string })?.code;
      // If popup was blocked by browser or on mobile, fallback to signInWithRedirect
      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
        console.warn('Popup blocked, attempting redirect sign-in...');
        await signInWithRedirect(auth, provider);
        return;
      }
      throw popupErr;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
    setCurrentUser(null);
  };

  const refreshProfile = async () => {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    } catch (e) {
      console.error('Refresh profile error:', e);
    }
  };

  const isBootstrapped = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isAdmin = isBootstrapped || userProfile?.role === 'admin';
  const isStudent = !isAdmin && userProfile?.role === 'student';
  const isBlocked = isStudent && userProfile?.status === 'blocked';
  const isRevoked = isStudent && userProfile?.status === 'revoked';
  const isActive = isStudent && userProfile?.status === 'active';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAdmin,
        isStudent,
        isActive,
        isBlocked,
        isRevoked,
        loading,
        authError,
        clearAuthError,
        loginWithEmail,
        loginWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
