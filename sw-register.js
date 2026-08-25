"serviceWorker"in navigator&&window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js?v=17",{scope:"/"}).catch(()=>{})});
