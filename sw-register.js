"serviceWorker"in navigator&&window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js?v=16",{scope:"/"}).catch(()=>{})});
