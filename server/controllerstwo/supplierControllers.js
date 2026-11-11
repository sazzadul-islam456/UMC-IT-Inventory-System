
import Supplier from '../models/Supplier.js';
import SupplierReturn from '../models/SupplierReturn.js';
import StockReceipt from '../models/StockReceipt.js';

// CREATE SUPPLIER
export const createSupplier = async (req, res) => {
    try {
        const {
            companyName,
            contactPerson,
            phone,
            email,
            address,
            notes
        } = req.body;

        if (!companyName || !companyName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Supplier company name is required'
            });
        }

        const supplier = await Supplier.create({
            companyName: companyName.trim(),
            contactPerson,
            phone,
            email,
            address,
            notes
        });

        return res.status(201).json({
            success: true,
            message: 'Supplier created successfully',
            supplier
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// GET ALL SUPPLIERS
export const getAllSuppliers = async (req, res) => {
    try {
        const {
            search = '',
            status = 'all',
            page = 1,
            limit = 20
        } = req.query;

        const filter = {};

        if (status === 'active') {
            filter.isActive = true;
        } else if (status === 'inactive') {
            filter.isActive = false;
        }

        if (search.trim()) {
            filter.$or = [
                { companyName: { $regex: search.trim(), $options: 'i' } },
                { contactPerson: { $regex: search.trim(), $options: 'i' } },
                { phone: { $regex: search.trim(), $options: 'i' } },
                { email: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        const currentPage = Math.max(1, Number(page) || 1);
        const pageLimit = Math.min(100, Math.max(1, Number(limit) || 20));
        const skip = (currentPage - 1) * pageLimit;

        const [suppliers, total] = await Promise.all([
            Supplier.find(filter)
                .sort({ companyName: 1 })
                .skip(skip)
                .limit(pageLimit),

            Supplier.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: suppliers.length,
            total,
            currentPage,
            totalPages: Math.ceil(total / pageLimit),
            suppliers
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET SINGLE SUPPLIER
export const getSupplierById = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            });
        }

        return res.status(200).json({
            success: true,
            supplier
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// UPDATE SUPPLIER
export const updateSupplier = async (req, res) => {
    try {
        const {
            companyName,
            contactPerson,
            phone,
            email,
            address,
            notes
        } = req.body;

        if (companyName !== undefined && !companyName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Supplier company name cannot be empty'
            });
        }

        const supplier = await Supplier.findByIdAndUpdate(
            req.params.id,
            {
                ...(companyName !== undefined && {
                    companyName: companyName.trim()
                }),
                ...(contactPerson !== undefined && { contactPerson }),
                ...(phone !== undefined && { phone }),
                ...(email !== undefined && { email }),
                ...(address !== undefined && { address }),
                ...(notes !== undefined && { notes })
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Supplier updated successfully',
            supplier
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// TOGGLE SUPPLIER STATUS
export const toggleSupplierStatus = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            });
        }

        supplier.isActive = !supplier.isActive;
        await supplier.save();

        return res.status(200).json({
            success: true,
            message: `Supplier ${supplier.isActive ? 'activated' : 'deactivated'} successfully`,
            supplier
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// DELETE SUPPLIER
export const deleteSupplier = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            });
        }

        const [returnExists, receiptExists] = await Promise.all([
            SupplierReturn.exists({ supplier: supplier._id }),
            StockReceipt.exists({
                supplier: supplier.companyName
            })
        ]);

        if (returnExists || receiptExists) {
            return res.status(400).json({
                success: false,
                message: 'This supplier has transaction history. Deactivate it instead of deleting.'
            });
        }

        await supplier.deleteOne();

        return res.status(200).json({
            success: true,
            message: 'Supplier deleted successfully'
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};
