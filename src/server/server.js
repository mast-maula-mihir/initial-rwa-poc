const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression and logging
app.use(compression());
app.use(morgan('combined'));

// Routes
app.use('/api/assets', require('./routes/assets'));
app.use('/api/validators', require('./routes/validators'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ipfs', require('./routes/ipfs'));

// Web3 assessment endpoint: read-only data from the USDC contract (Ethereum mainnet)
const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com'
);
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)'
];

app.get('/MihirRanadeApiTest', async (req, res) => {
  const { address } = req.query;
  if (address !== undefined && !ethers.utils.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid address query parameter' });
  }

  try {
    const contract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
    const [name, symbol, decimals, totalSupply, balance] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
      address ? contract.balanceOf(address) : Promise.resolve(null)
    ]);

    const result = {
      contractAddress: USDC_ADDRESS,
      name,
      symbol,
      decimals,
      totalSupply: ethers.utils.formatUnits(totalSupply, decimals),
      ...(address && { holder: address, balance: ethers.utils.formatUnits(balance, decimals) })
    };

    console.log('Smart contract data fetched successfully:', result);
    res.json(result);
  } catch (error) {
    console.error('Smart contract error:', error.message);
    res.status(502).json({ error: 'Failed to fetch smart contract data' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;