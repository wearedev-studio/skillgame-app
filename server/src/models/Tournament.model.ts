import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITournamentPlayer {
    _id: string;
    username: string;
    socketId?: string;
    isBot: boolean;
    registeredAt: Date;
}

export interface ITournamentMatch {
    matchId: Types.ObjectId;
    player1: ITournamentPlayer;
    player2: ITournamentPlayer;
    winner?: ITournamentPlayer;
    status: 'WAITING' | 'PENDING' | 'ACTIVE' | 'FINISHED';
}

export interface ITournamentRound {
    round: number;
    matches: ITournamentMatch[];
}

export interface ITournament extends Document {
    _id: Types.ObjectId;
    name: string;
    gameType: 'tic-tac-toe' | 'checkers' | 'chess' | 'backgammon' | 'durak' | 'domino' | 'dice' | 'bingo';
    status: 'WAITING' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
    entryFee: number;
    prizePool: number;
    maxPlayers: number;
    players: ITournamentPlayer[];
    bracket: ITournamentRound[];
    platformCommission: number;
    firstRegistrationTime?: Date;
    startedAt?: Date;
    finishedAt?: Date;
    winner?: ITournamentPlayer;
    createdAt: Date;
    updatedAt: Date;
}

const tournamentPlayerSchema = new Schema({
    _id: { type: String, required: true },
    username: { type: String, required: true },
    socketId: { type: String },
    isBot: { type: Boolean, required: true, default: false },
    registeredAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const tournamentMatchSchema = new Schema({
    matchId: { type: Schema.Types.ObjectId, required: true, default: () => new Types.ObjectId() },
    player1: { type: tournamentPlayerSchema, required: true },
    player2: { type: tournamentPlayerSchema, required: true },
    winner: { type: tournamentPlayerSchema },
    status: { 
        type: String, 
        required: true, 
        enum: ['WAITING', 'PENDING', 'ACTIVE', 'FINISHED'],
        default: 'WAITING'
    }
}, { _id: false });

const tournamentRoundSchema = new Schema({
    round: { type: Number, required: true },
    matches: [tournamentMatchSchema]
}, { _id: false });

const tournamentSchema = new Schema<ITournament>({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    gameType: {
        type: String,
        required: true,
        enum: ['tic-tac-toe', 'checkers', 'chess', 'backgammon', 'durak', 'domino', 'dice', 'bingo']
    },
    status: {
        type: String,
        required: true,
        enum: ['WAITING', 'ACTIVE', 'FINISHED', 'CANCELLED'],
        default: 'WAITING'
    },
    entryFee: { 
        type: Number, 
        required: true, 
        min: 0,
        default: 0 
    },
    prizePool: { 
        type: Number, 
        required: true,
        min: 0,
        default: 0 
    },
    maxPlayers: {
        type: Number,
        required: true,
        enum: [4, 8, 16, 32],
        default: 8
    },
    players: [tournamentPlayerSchema],
    bracket: [tournamentRoundSchema],
    platformCommission: { 
        type: Number, 
        required: true,
        min: 0,
        max: 100,
        default: 10 
    },
    firstRegistrationTime: { type: Date },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    winner: { type: tournamentPlayerSchema }
}, {
    timestamps: true
});

tournamentSchema.index({ status: 1, createdAt: -1 });
tournamentSchema.index({ gameType: 1, status: 1 });
tournamentSchema.index({ 'players._id': 1 });

tournamentSchema.virtual('isActive').get(function() {
    return this.status === 'ACTIVE';
});

tournamentSchema.virtual('isWaiting').get(function() {
    return this.status === 'WAITING';
});

tournamentSchema.virtual('isFinished').get(function() {
    return this.status === 'FINISHED';
});

tournamentSchema.virtual('currentPlayerCount').get(function() {
    return this.players.length;
});

tournamentSchema.virtual('spotsRemaining').get(function() {
    return this.maxPlayers - this.players.length;
});

tournamentSchema.virtual('isFull').get(function() {
    return this.players.length >= this.maxPlayers;
});

tournamentSchema.methods.addPlayer = function(player: ITournamentPlayer) {
    if (this.isFull) {
        throw new Error('Tournament is full');
    }
    if (this.status !== 'WAITING') {
        throw new Error('Tournament is not accepting registrations');
    }
    if (this.players.some((p: ITournamentPlayer) => p._id === player._id)) {
        throw new Error('Player already registered');
    }
    
    this.players.push(player);
    
    if (!this.firstRegistrationTime) {
        this.firstRegistrationTime = new Date();
    }
    
    return this;
};

tournamentSchema.methods.removePlayer = function(playerId: string) {
    if (this.status !== 'WAITING') {
        throw new Error('Cannot remove player from active tournament');
    }
    
    const playerIndex = this.players.findIndex((p: ITournamentPlayer) => p._id === playerId);
    if (playerIndex === -1) {
        throw new Error('Player not found in tournament');
    }
    
    this.players.splice(playerIndex, 1);
    
    if (this.players.length === 0) {
        this.firstRegistrationTime = undefined;
    }
    
    return this;
};

tournamentSchema.methods.start = function() {
    if (this.status !== 'WAITING') {
        throw new Error('Tournament is not in waiting state');
    }
    if (this.players.length < 2) {
        throw new Error('Not enough players to start tournament');
    }
    
    this.status = 'ACTIVE';
    this.startedAt = new Date();
    
    return this;
};

tournamentSchema.methods.finish = function(winner?: ITournamentPlayer) {
    if (this.status !== 'ACTIVE') {
        throw new Error('Tournament is not active');
    }
    
    this.status = 'FINISHED';
    this.finishedAt = new Date();
    if (winner) {
        this.winner = winner;
    }
    
    return this;
};

tournamentSchema.methods.cancel = function() {
    if (this.status === 'FINISHED') {
        throw new Error('Cannot cancel finished tournament');
    }
    
    this.status = 'CANCELLED';
    
    return this;
};

tournamentSchema.statics.findActive = function() {
    return this.find({ status: { $in: ['WAITING', 'ACTIVE'] } }).sort({ createdAt: -1 });
};

tournamentSchema.statics.findByGameType = function(gameType: string) {
    return this.find({ gameType, status: { $in: ['WAITING', 'ACTIVE'] } }).sort({ createdAt: -1 });
};

tournamentSchema.statics.findByPlayer = function(playerId: string) {
    return this.find({ 'players._id': playerId }).sort({ createdAt: -1 });
};

tournamentSchema.pre('save', function(next) {
    if (this.isModified('players') || this.isModified('entryFee')) {
        const totalEntry = this.players.length * this.entryFee;
        this.prizePool = totalEntry;
    }
    
    next();
});

const Tournament = mongoose.model<ITournament>('Tournament', tournamentSchema);

export default Tournament;