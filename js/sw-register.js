"serviceWorker"in navigator&&window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js?v=18",{scope:"/"}).catch(()=>{})});
