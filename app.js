 <script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js"; 
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries
 
  // Your web app's Firebase configuration 
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyB2qKFaqsibIOWDgemNunl5oNAZiJKZ9vk",
    authDomain: "nizzebook.firebaseapp.com",
    projectId: "nizzebook",
    storageBucket: "nizzebook.firebasestorage.app",
    messagingSenderId: "724232028497",
    appId: "1:724232028497:web:d905067e30c6d70b5c9370",
    measurementId: "G-VZKNZCWVX4"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>





