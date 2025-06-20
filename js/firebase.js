// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDd4aXqEpMqPQljMQrg0yZjSB-Lcs069C8",
  authDomain: "realtime-chat-go.firebaseapp.com",
  projectId: "realtime-chat-go",
  storageBucket: "realtime-chat-go.appspot.com",
  messagingSenderId: "1045897341591",
  appId: "1:1045897341591:web:d5c48955d86eefe01a97d2",
  measurementId: "G-KVV2M7Y70W"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// Enable analytics (optional)
firebase.analytics();
