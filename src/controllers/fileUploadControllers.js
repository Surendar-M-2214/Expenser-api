import multer from 'multer';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import { gemini } from '../config/gemini.js';
import { sql } from '../config/db.js';
import { Readable } from 'stream';

// Dynamic import for pdf-parse to avoid the test file issue
let pdfParse;
const loadPdfParse = async () => {
  if (!pdfParse) {
    const pdfModule = await import('pdf-parse');
    pdfParse = pdfModule.default;
  }
  return pdfParse;
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf', // Temporarily disabled due to library issues
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are currently supported.'), false);
    }
  }
});

// Helper function to extract text from PDF
async function extractTextFromPDF(buffer) {
  try {
    const pdf = await loadPdfParse();
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

// Helper function to parse CSV
async function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer);
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Helper function to parse Excel
function parseExcel(buffer) {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    return jsonData;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw new Error('Failed to parse Excel file');
  }
}

// Helper function to process file content with AI
async function processFileWithAI(fileContent, fileType, fileName) {
  try {
    let prompt = '';
    
    if (fileType === 'csv' || fileType === 'excel') {
      prompt = `You are a financial data processor. Analyze the following ${fileType.toUpperCase()} data and extract transaction information. 
      
      File: ${fileName}
      Data: ${JSON.stringify(fileContent, null, 2)}
      
      Please extract transaction data and return it in the following JSON format:
      {
        "transactions": [
          {
            "date": "YYYY-MM-DD",
            "description": "Simple, informal transaction title",
            "amount": 123.45,
            "type": "debit" or "credit",
            "category": "Category name",
            "reference": "Transaction ID or reference number"
          }
        ]
      }
      
      Rules for Excel/CSV processing:
      - Convert all dates to YYYY-MM-DD format
      - Ensure amounts are positive numbers
      - Determine type based on context (debit for expenses, credit for income)
      - Categorize transactions appropriately (Food & Drinks, Shopping, Transportation, Entertainment, Bills, Income, Other)
      
      For transaction descriptions:
      - Make them informal and easy to understand
      - Use simple, everyday language
      - Examples: "Coffee at Starbucks", "Uber ride", "Grocery shopping", "Salary payment", "Electricity bill"
      - Avoid technical jargon or complex terms
      - Keep descriptions concise but descriptive
      
      For reference field:
      - Store any transaction ID, reference number, or unique identifier from the data
      - If no ID is available, use a meaningful identifier like "TXN-001", "REF-123", etc.
      - This helps track the original transaction in the source system
      
      Amount handling:
      - If amount is negative, make it positive and set type to "debit"
      - If amount is positive and appears to be income, set type to "credit"
      - For expenses, use "debit" type
      - For income/salary/refunds, use "credit" type
      
      Return only valid JSON, no additional text`;
    } else if (fileType === 'pdf') {
      prompt = `You are a financial data processor. Analyze the following PDF text content and extract transaction information.
      
      File: ${fileName}
      Content: ${fileContent}
      
      Please extract transaction data and return it in the following JSON format:
      {
        "transactions": [
          {
            "date": "YYYY-MM-DD",
            "description": "Simple, informal transaction title",
            "amount": 123.45,
            "type": "debit" or "credit",
            "category": "Category name",
            "reference": "Transaction ID or reference number"
          }
        ]
      }
      
      Rules for PDF processing:
      - Convert all dates to YYYY-MM-DD format
      - Ensure amounts are positive numbers
      - Determine type based on context (debit for expenses, credit for income)
      - Categorize transactions appropriately (Food & Drinks, Shopping, Transportation, Entertainment, Bills, Income, Other)
      
      For transaction descriptions:
      - Make them informal and easy to understand
      - Use simple, everyday language
      - Examples: "Coffee at Starbucks", "Uber ride", "Grocery shopping", "Salary payment", "Electricity bill"
      - Avoid technical jargon or complex terms
      - Keep descriptions concise but descriptive
      
      For reference field:
      - Store any transaction ID, reference number, or unique identifier from the content
      - If no ID is available, use a meaningful identifier like "TXN-001", "REF-123", etc.
      - This helps track the original transaction in the source system
      
      Amount handling:
      - If amount is negative, make it positive and set type to "debit"
      - If amount is positive and appears to be income, set type to "credit"
      - For expenses, use "debit" type
      - For income/salary/refunds, use "credit" type
      
      Return only valid JSON, no additional text`;
    }
    
    const aiResponse = await gemini(prompt);
    
    // Try to parse the AI response as JSON
    try {
      const cleanedResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsedData = JSON.parse(cleanedResponse);
      return parsedData;
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('AI Response:', aiResponse);
      throw new Error('AI response could not be parsed as valid JSON');
    }
  } catch (error) {
    console.error('Error processing file with AI:', error);
    throw new Error('Failed to process file with AI');
  }
}

// File upload and processing endpoint
export const uploadFile = [
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      const file = req.file;
      const fileType = file.mimetype;
      let fileContent;
      let processedData;

      console.log(`Processing file: ${file.originalname}, Type: ${fileType}`);

      // Process file based on type
      if (fileType === 'text/csv') {
        fileContent = await parseCSV(file.buffer);
        processedData = await processFileWithAI(fileContent, 'csv', file.originalname);
      } else if (fileType === 'application/vnd.ms-excel' || 
                 fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        fileContent = parseExcel(file.buffer);
        processedData = await processFileWithAI(fileContent, 'excel', file.originalname);
      } else if (fileType === 'application/pdf') {
        try {
          fileContent = await extractTextFromPDF(file.buffer);
          processedData = await processFileWithAI(fileContent, 'pdf', file.originalname);
        } catch (pdfError) {
          console.error('PDF processing error:', pdfError);
          return res.status(400).json({
            success: false,
            error: 'PDF processing is currently unavailable. Please try uploading a CSV or Excel file instead.'
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'Unsupported file type'
        });
      }

      // Validate processed data
      if (!processedData || !processedData.transactions || !Array.isArray(processedData.transactions)) {
        return res.status(400).json({
          success: false,
          error: 'Failed to extract transaction data from file'
        });
      }

      // Validate each transaction
      const validatedTransactions = processedData.transactions.filter(transaction => {
        return transaction.date && 
               transaction.description && 
               transaction.amount && 
               transaction.type && 
               transaction.category;
      });

      if (validatedTransactions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid transactions found in the file'
        });
      }

      res.json({
        success: true,
        data: {
          fileName: file.originalname,
          fileType: fileType,
          totalTransactions: validatedTransactions.length,
          transactions: validatedTransactions
        }
      });

    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process file'
      });
    }
  }
];

// Bulk upload transactions to database
export const bulkUploadTransactions = async (req, res) => {
  try {
    const { userId, transactions } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Transactions array is required and must not be empty'
      });
    }

    // Validate user exists
    const userExists = await sql`SELECT id FROM users WHERE id = ${userId}`;
    if (userExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prepare transactions for bulk insert
    const transactionData = transactions.map(transaction => ({
      user_id: userId,
      amount: parseFloat(transaction.amount),
      currency: 'INR',
      type: transaction.type,
      category: transaction.category,
      description: transaction.description,
      reference: transaction.reference || null,
      transaction_date: transaction.date,
      tags: [],
      receipt_url: null,
      receipt_filename: null
    }));

    // Insert transactions in batches
    const batchSize = 100;
    const results = [];
    
    for (let i = 0; i < transactionData.length; i += batchSize) {
      const batch = transactionData.slice(i, i + batchSize);
      
      const insertedTransactions = await sql`
        INSERT INTO user_transactions (
          user_id, amount, currency, type, category, description, 
          reference, transaction_date, tags, receipt_url, receipt_filename
        ) VALUES ${sql(batch)}
        RETURNING *
      `;
      
      results.push(...insertedTransactions);
    }

    res.json({
      success: true,
      data: {
        totalUploaded: results.length,
        transactions: results
      }
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload transactions'
    });
  }
};

// Get upload history for a user
export const getUploadHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get recent transactions grouped by upload date
    const uploadHistory = await sql`
      SELECT 
        DATE(created_at) as upload_date,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        STRING_AGG(DISTINCT category, ', ') as categories
      FROM user_transactions 
      WHERE user_id = ${userId} 
        AND receipt_filename IS NULL
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY upload_date DESC
      LIMIT 10
    `;

    res.json({
      success: true,
      data: uploadHistory
    });

  } catch (error) {
    console.error('Get upload history error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get upload history'
    });
  }
};
