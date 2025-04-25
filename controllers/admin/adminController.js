const User=require("../../models/userSchema")
const Order=require("../../models/orderSchema")
const Product=require("../../models/productSchema")
const Coupon=require("../../models/couponSchema")
const Category = require("../../models/categorySchema");
const mongoose=require("mongoose")
const bcrypt=require("bcrypt")
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit-table');
const { format } = require('date-fns');
const STATUS_CODES=require("../../constants/statusCodes")
const MESSAGES=require("../../constants/messages")

const pageerror=async(req,res)=>{
    res.render("pageerror")
}

const getBestSellingProducts = async (dateFilter) => {
  try {
      const bestProducts = await Order.aggregate([
          { $match: { ...dateFilter, status: 'Delivered' } },
          { $unwind: '$orderItems' }, 
          {
              $group: {
                  _id: '$orderItems.product',
                  totalSold: { $sum: '$orderItems.variants.quantity' }, // Updated path
                  totalRevenue: { $sum: '$orderItems.price' }
              }
          },
          {
              $lookup: {
                  from: 'products',
                  localField: '_id',
                  foreignField: '_id',
                  as: 'productInfo'
              }
          },
          { $unwind: '$productInfo' },
          {
              $project: {
                  productName: '$productInfo.productName',
                  totalSold: 1,
                  totalRevenue: 1
              }
          },
          { $sort: { totalSold: -1 } },
          { $limit: 10 }
      ]);
      return bestProducts;
  } catch (error) {
      console.error('Error in getBestSellingProducts:', error);
      return [];
  }
};

const getBestCategories = async (dateFilter) => {
    try {
        const bestCategories = await Order.aggregate([
            { $match: { ...dateFilter, status: 'Delivered' } },
            { $unwind: '$orderItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: '$productInfo' },
            {
                $group: {
                    _id: '$productInfo.category',
                    totalSold: { $sum: '$orderItems.variants.quantity' },
                    totalRevenue: { $sum: '$orderItems.price' }
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoryInfo'
                }
            },
            { $unwind: '$categoryInfo' },
            {
                $project: {
                    categoryName: '$categoryInfo.name',
                    totalSold: 1,
                    totalRevenue: 1
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 } // Changed from 5 to 10
        ]);
        return bestCategories;
    } catch (error) {
        console.error('Error in getBestCategories:', error);
        return [];
    }
  };

const getSalesData = async (dateFilter) => {
  try {
      const salesData = await Order.aggregate([
          { $match: { ...dateFilter, status: 'Delivered' } },
          {
              $group: {
                  _id: {
                      $dateToString: { format: "%Y-%m-%d", date: "$createdOn" }
                  },
                  totalSales: { $sum: '$finalAmount' },
                  totalOrders: { $sum: 1 }
              }
          },
          {
              $project: {
                  date: '$_id',
                  totalSales: 1,
                  totalOrders: 1,
                  _id: 0
              }
          },
          { $sort: { date: 1 } }
      ]);
      return salesData;
  } catch (error) {
      console.error('Error in getSalesData:', error);
      return [];
  }
};

const loadLogin=(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login",{message:null})
}

const login=async(req,res)=>{
    try{
    const {password,email}=req.body;
    const admin=await User.findOne({email,isAdmin:true});
    console.log(admin)
    if(admin){
        const passwordMatch=bcrypt.compare(password,admin.password)
        if(passwordMatch){
            req.session.admin=true;
            req.session.adminData=admin;
            return res.redirect("/admin/dashboard")
        }else{
            return res.redirect("/admin/login")
        }
    }else{
        return res.redirect("/admin/login")
    }
}catch(error){
    console.log("login error",error);
    return res.redirect('/pageerror')
    
}
}

const createDateFilter = (filter, startDate, endDate) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let dateFilter = {};
  
    switch (filter?.toLowerCase()) {
      case 'daily':
        dateFilter = { createdOn: { $gte: today, $lte: new Date(now.setHours(23, 59, 59, 999)) } };
        break;
      case 'weekly':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        dateFilter = { createdOn: { $gte: weekStart, $lte: new Date(now.setHours(23, 59, 59, 999)) } };
        break;
      case 'monthly':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        dateFilter = { createdOn: { $gte: monthStart, $lte: new Date(now.setHours(23, 59, 59, 999)) } };
        break;
      case 'yearly':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        dateFilter = { createdOn: { $gte: yearStart, $lte: new Date(now.setHours(23, 59, 59, 999)) } };
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter = {
            createdOn: {
              $gte: new Date(startDate),
              $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            }
          };
        }
        break;
      default:
        dateFilter = { createdOn: { $gte: today, $lte: new Date(now.setHours(23, 59, 59, 999)) } };
    }
    return dateFilter;
  };
  const loadDashboard = async (req, res) => {
    const { page = 1, filter = 'daily', startDate, endDate } = req.query;
    const limit = 6;
  
    try {
        if (filter === 'custom') {
            if (!startDate || !endDate) {
                throw new Error('Start date and end date are required for custom filter.');
            }
  
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new Error('Invalid date format for start date or end date.');
            }
  
            if (end < start) {
                throw new Error('End date cannot be before start date.');
            }
  
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            if (start > today || end > today) {
                throw new Error('Dates cannot be in the future.');
            }
        }
  
        const dateFilter = createDateFilter(filter, startDate, endDate);
  
        const [
            totalOrders,
            salesSummary,
            orders,
            totalUsers,
            totalProducts,
            totalCoupons,
            bestSellingProducts,
            bestCategories,
            salesData
        ] = await Promise.all([
            Order.countDocuments({ ...dateFilter, status: 'Delivered' }),
            Order.aggregate([
                { $match: { ...dateFilter, status: 'Delivered' } },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: '$finalAmount' },
                        totalDiscount: { $sum: '$discount' },
                        totalCouponDiscount: { $sum: '$couponDiscount' }
                    }
                }
            ]),
            Order.find({ ...dateFilter, status: 'Delivered' })
                .populate('orderItems.product', 'productName')
                .sort({ createdOn: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            User.countDocuments(),
            Product.countDocuments(),
            Coupon.countDocuments(),
            getBestSellingProducts(dateFilter),
            getBestCategories(dateFilter),
            getSalesData(dateFilter)
        ]);
  
        const responseData = {
            totalOrders,
            totalSales: salesSummary[0]?.totalSales || 0,
            totalDiscount: salesSummary[0]?.totalDiscount || 0,
            totalCouponDiscount: salesSummary[0]?.totalCouponDiscount || 0,
            orders: orders || [],
            totalUsers,
            totalProducts,
            totalCoupons,
            bestSellingProducts,
            bestCategories,
            salesData,
            totalPages: Math.ceil(totalOrders / limit),
            currentPage: parseInt(page),
            selectedFilter: filter,
            startDate: startDate || '',
            endDate: endDate || ''
        };
  
        res.render('dashboard', responseData);
    } catch (error) {
        console.error('Error loading dashboard:', error.message);
        res.render('dashboard', {
            totalOrders: 0,
            totalSales: 0,
            totalDiscount: 0,
            totalCouponDiscount: 0,
            orders: [],
            totalUsers: 0,
            totalProducts: 0,
            totalCoupons: 0,
            bestSellingProducts: [],
            bestCategories: [],
            salesData: [],
            totalPages: 0,
            currentPage: 1,
            selectedFilter: filter || 'daily',
            startDate: startDate || '',
            endDate: endDate || '',
            errorMessage: error.message
        });
    }
};
const logout = (req, res) => {
    try {
        delete req.session.admin;
        delete req.session.adminData;
        res.redirect("/admin/login");
    } catch (error) {
        console.log('logout error', error);
        res.redirect("/pageerror");
    }
};

const generateSalesReport = async (req, res) => {
  try {
      const { filter = 'daily', startDate, endDate } = req.query;
      const dateFilter = createDateFilter(filter, startDate, endDate);

      const orders = await Order.aggregate([
          { $match: { ...dateFilter, status: 'Delivered' } },
          { $unwind: '$orderItems' }, 
          {
              $lookup: {
                  from: 'products',
                  localField: 'orderItems.product',
                  foreignField: '_id',
                  as: 'productInfo'
              }
          },
          {
              $group: {
                  _id: '$_id',
                  orderId: { $first: '$orderId' },
                  createdOn: { $first: '$createdOn' },
                  totalPrice: { $first: '$totalPrice' },
                  discount: { $first: '$discount' },
                  couponCode: { $first: '$couponCode' },
                  finalAmount: { $first: '$finalAmount' },
                  items: {
                      $push: {
                          productName: { $arrayElemAt: ['$productInfo.productName', 0] },
                          quantity: '$orderItems.variants.quantity', // Updated path
                          price: '$orderItems.price'
                      }
                  }
              }
          },
          { $sort: { createdOn: -1 } }
      ]);

      const summary = await Order.aggregate([
          { $match: { ...dateFilter, status: 'Delivered' } },
          {
              $group: {
                  _id: null,
                  totalOrders: { $sum: 1 },
                  totalAmount: { $sum: '$totalPrice' },
                  totalDiscount: { $sum: '$discount' },
                  totalCouponDiscount: { $sum: 0 }, 
                  finalAmount: { $sum: '$finalAmount' }
              }
          }
      ]);

      res.render('admin/sales-report', {
          filter,
          startDate,
          endDate,
          orders,
          summary: summary[0] || {
              totalOrders: 0,
              totalAmount: 0,
              totalDiscount: 0,
              totalCouponDiscount: 0,
              finalAmount: 0
          }
      });
  } catch (error) {
      console.error('Error generating sales report:', error);
      res.redirect('/admin/pageerror');
  }
};
const downloadExcelReport = async (req, res) => {
  try {
      const { filter = 'daily', startDate, endDate } = req.query;
      const dateFilter = createDateFilter(filter, startDate, endDate);

      const queryFilter = { ...dateFilter, status: 'Delivered' };
      const orders = await Order.find(queryFilter).populate('orderItems.product'); 
      const summary = await Order.aggregate([
          { $match: queryFilter },
          {
              $group: {
                  _id: null,
                  totalOrders: { $sum: 1 },
                  totalAmount: { $sum: '$totalPrice' },
                  totalDiscount: { $sum: '$discount' },
                  totalCouponDiscount: { $sum: 0 }, 
                  finalAmount: { $sum: '$finalAmount' }
              }
          }
      ]);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Report');

      // Add headers
      worksheet.addRow(['Sales Report']);
      worksheet.addRow(['Filter:', filter]);
      worksheet.addRow([
          'Date Range:',
          `${format(dateFilter.createdOn.$gte, 'yyyy-MM-dd')} to ${format(dateFilter.createdOn.$lte, 'yyyy-MM-dd')}`
      ]);
      worksheet.addRow([]);

      // Define columns
      worksheet.columns = [
          { header: 'Order ID', key: 'orderId', width: 20 },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Product', key: 'product', width: 25 },
          { header: 'Quantity', key: 'quantity', width: 10 },
          { header: 'Price', key: 'price', width: 12 },
          { header: 'Discount', key: 'discount', width: 12 },
          { header: 'Coupon Code', key: 'couponCode', width: 15 },
          { header: 'Coupon Discount', key: 'couponDiscount', width: 15 },
          { header: 'Final Amount', key: 'finalAmount', width: 12 }
      ];

      // Add order data
      orders.forEach(order => {
          order.orderItems.forEach(item => { 
              worksheet.addRow({
                  orderId: order.orderId,
                  date: format(order.createdOn, 'yyyy-MM-dd'),
                  product: item.product?.productName || 'N/A',
                  quantity: item.variants?.quantity || 0,   
                  price: item.price || 0,
                  discount: order.discount || 0,
                  couponCode: order.couponCode || 'N/A',
                  couponDiscount: 0, 
                  finalAmount: order.finalAmount || 0
              });
          });
      });

      // Add summary
      worksheet.addRow([]);
      worksheet.addRow(['Summary']);
      const sum = summary[0] || {};
      worksheet.addRow(['Total Orders:', sum.totalOrders || 0]);
      worksheet.addRow(['Total Amount:', `₹${(sum.totalAmount || 0).toFixed(2)}`]);
      worksheet.addRow(['Total Discount:', `₹${(sum.totalDiscount || 0).toFixed(2)}`]);
      worksheet.addRow(['Total Coupon Discount:', `₹${(sum.totalCouponDiscount || 0).toFixed(2)}`]);
      worksheet.addRow(['Final Amount:', `₹${(sum.finalAmount || 0).toFixed(2)}`]);

      // Format currency columns
      ['price', 'discount', 'couponDiscount', 'finalAmount'].forEach(key => {
          worksheet.getColumn(key).numFmt = '₹#,##0.00';
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=SalesReport.xlsx');
      await workbook.xlsx.write(res);
      res.end();
  } catch (error) {
      console.error('Error generating Excel:', error);
      res.redirect('/admin/pageerror');
  }
};

const downloadPDFReport = async (req, res) => {
  try {
      const { filter = 'daily', startDate, endDate } = req.query;
      const dateFilter = createDateFilter(filter, startDate, endDate);

      const queryFilter = { ...dateFilter, status: 'Delivered' };
      const orders = await Order.find(queryFilter).populate('orderItems.product');  
      const summary = await Order.aggregate([
          { $match: queryFilter },
          {
              $group: {
                  _id: null,
                  totalOrders: { $sum: 1 },
                  totalAmount: { $sum: '$totalPrice' },
                  totalDiscount: { $sum: '$discount' },
                  totalCouponDiscount: { $sum: 0 }, 
                  finalAmount: { $sum: '$finalAmount' }
              }
          }
      ]);

      const doc = new PDFDocument({ margin: 30 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=SalesReport.pdf');
      doc.pipe(res);

      // Add title and metadata
      doc.fontSize(20).text('Sales Report', { align: 'center' });
      doc.fontSize(12)
          .text(`Filter: ${filter}`)
          .text(`Date Range: ${format(dateFilter.createdOn.$gte, 'yyyy-MM-dd')} to ${format(dateFilter.createdOn.$lte, 'yyyy-MM-dd')}`);
      doc.moveDown();

      // Prepare table data
      const tableData = orders.flatMap(order =>
          order.orderItems.map(item => ({ 
              orderId: order.orderId.slice(0, 12),
              date: format(order.createdOn, 'yyyy-MM-dd'),
              product: item.product?.productName || 'N/A',
              qty: item.variants?.quantity || 0, 
              price: `₹${(item.price || 0).toFixed(2)}`,
              discount: `₹${(order.discount || 0).toFixed(2)}`,
              couponCode: order.couponCode || 'N/A',
              couponDiscount: `₹${0}`, 
              final: `₹${(order.finalAmount || 0).toFixed(2)}`
          }))
      );

      if (tableData.length === 0) {
          doc.fontSize(12).text('No delivered orders found for the selected date range.', { align: 'center' });
      } else {
          const table = {
              headers: [
                  { label: 'Order ID', property: 'orderId', width: 80 },
                  { label: 'Date', property: 'date', width: 70 },
                  { label: 'Product', property: 'product', width: 100 },
                  { label: 'Qty', property: 'qty', width: 40 },
                  { label: 'Price', property: 'price', width: 60 },
                  { label: 'Discount', property: 'discount', width: 60 },
                  { label: 'Coupon Code', property: 'couponCode', width: 60 },
                  { label: 'Coupon Discount', property: 'couponDiscount', width: 60 },
                  { label: 'Final', property: 'final', width: 60 }
              ],
              datas: tableData
          };

          await doc.table(table, {
              prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
              prepareRow: () => doc.font('Helvetica').fontSize(9)
          });
      }

      // Add summary
      doc.moveDown()
          .fontSize(12)
          .text('Summary', { underline: true })
          .fontSize(11);
      const sum = summary[0] || {};
      doc.text(`Total Orders: ${sum.totalOrders || 0}`)
          .text(`Total Amount: ₹${(sum.totalAmount || 0).toFixed(2)}`)
          .text(`Total Discount: ₹${(sum.totalDiscount || 0).toFixed(2)}`)
          .text(`Total Coupon Discount: ₹${(sum.totalCouponDiscount || 0).toFixed(2)}`)
          .text(`Final Amount: ₹${(sum.finalAmount || 0).toFixed(2)}`);

      doc.end();
  } catch (error) {
      console.error('Error generating PDF:', error);
      res.redirect('/admin/pageerror');
  }
};

// const increaseSalary=async (req,res)=>{
//     try {
        
//         const employees= await Employee.find({department:"HR"})

//         for(employee of employees){
//              let newSalary=employee.salary*1.10
//              let emplyeeid=employee._id
//              await Employee.updateOne({_id:emplyeeid},{$set:{salary:newSalary}})
//         }
//         res.status(200).json({
//             message:"ok",
//             employees:employees
//         })

//     } catch (error) {
//         res.status(500).json({message:"internal server error"})
//     }
// }


module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    generateSalesReport,
    downloadExcelReport,
    downloadPDFReport,

}