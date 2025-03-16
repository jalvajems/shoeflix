const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
},
  balance: { 
    type: Number, 
    default: 0 
},
  transactionHistory: [{
    transactionType: { 
        type: String, 
        enum: ['deposit', 'refund', 'purchase', 'wallet-to-wallet', 'manual'], 
        required: true 
    },
    transactionAmount: { 
        type: Number, 
        required: true
    },
    transactionDate: { 
        type: Date, 
        default: Date.now 
    },
    description: { 
        type: String, 
        default: '' 
    }
  }],
}, { timestamps: true });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = { Wallet };