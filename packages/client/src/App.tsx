 import React from 'react';
 import Room from './components/Room';
 import './App.scss';
 
 const createRoom = () => {
   // Do not use the symbol "_" in room address
   window.location.href = `${new Date().getTime()}?uid=1`;
 };
 
 function App() {
   const isHall = window.location.pathname === '/';
   return (
     <div>
       {isHall ? (
         <button type="button" onClick={createRoom}>
           Create room
         </button>
       ) : (
         <Room
            server={ process.env.REACT_APP_SERVER as string}
            port={3002}
            iceServers={[]}
            id={window.location.search.replace(/\?uid=/, '')}
         />
       )}
     </div>
   );
 }
 
 export default App;
 