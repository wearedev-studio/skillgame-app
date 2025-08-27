import app from './app';
import connectDB from './config/db';
import http from 'http';
import { Server } from 'socket.io';
import { initializeSocket, rooms, gameLogics } from './socket';
import { setSocketData } from './controllers/admin.controller';
import tournamentScheduler from './services/tournamentScheduler.service';
import gameLobbyScheduler from './services/gameLobbyScheduler.service';

connectDB();

const PORT = process.env.PORT || 5001;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins explicitly
    methods: ["GET", "POST"],
    credentials: false
  }
});

initializeSocket(io);

setSocketData(rooms, gameLogics);

app.set('io', io);

// Запускаем планировщики после инициализации
setTimeout(() => {
    console.log('🎯 Starting tournament scheduler...');
    tournamentScheduler.start();
    
    console.log('🎮 Starting game lobby scheduler...');
    gameLobbyScheduler.start();
}, 5000); // Задержка для полной инициализации системы

server.listen(PORT, () => console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`));