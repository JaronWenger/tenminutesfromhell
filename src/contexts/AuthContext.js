import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange, signOut } from '../firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser?.email) {
        try {
          const blocked = await getDoc(doc(db, 'blockedEmails', firebaseUser.email.toLowerCase()));
          if (blocked.exists()) {
            await signOut();
            setUser(null);
            setLoading(false);
            return;
          }
        } catch {} // fail open — don't block legitimate users on Firestore errors
      }
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    return { user: null, loading: false };
  }
  return context;
};
