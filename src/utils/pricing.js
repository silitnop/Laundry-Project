// Utility for Berkah Laundry pricing calculation, default matrix, and tier management.

export const CUSTOMER_TIERS = {
  kedaung: {
    id: 'kedaung',
    name: 'Warga Kedaung (Khusus)',
    shortName: 'Kedaung',
    description: 'Harga khusus untuk warga Kedaung',
  },
  umum: {
    id: 'umum',
    name: 'Luar Kedaung',
    shortName: 'Luar Kedaung',
    description: 'Harga untuk pelanggan luar Kedaung',
  },
};

export const SERVICES = {
  reguler: {
    id: 'reguler',
    name: 'Reguler',
    durationDays: 3,
    durationLabel: '3 - 4 Hari',
  },
  express: {
    id: 'express',
    name: 'Express',
    durationDays: 1,
    durationLabel: '1 Hari',
  },
  express_kilat: {
    id: 'express_kilat',
    name: 'Express Kilat',
    durationDays: 0,
    durationLabel: '< 1 Hari (Selesai Hari Ini)',
  },
};

export const PACKAGES = {
  cuci_setrika: {
    id: 'cuci_setrika',
    name: 'Cuci Setrika',
    description: 'Cuci bersih, dikeringkan, dan disetrika rapi',
  },
  cuci_lipat: {
    id: 'cuci_lipat',
    name: 'Cuci Lipat',
    description: 'Cuci bersih, dikeringkan, dan dilipat rapi tanpa setrika',
  },
  setrika_saja: {
    id: 'setrika_saja',
    name: 'Setrika Saja',
    description: 'Hanya setrika pakaian yang sudah dicuci',
  },
};

// Default pricing matrix per kg (as requested by Owner)
export const DEFAULT_PRICE_MATRIX = {
  reguler: {
    estimation_days: 3,
    prices: {
      cuci_setrika: { kedaung: 8000, umum: 9000 },
      cuci_lipat: { kedaung: 5000, umum: 6000 },
      setrika_saja: { kedaung: 5000, umum: 6000 },
    },
  },
  express: {
    estimation_days: 1,
    prices: {
      cuci_setrika: { kedaung: 10000, umum: 12000 },
      cuci_lipat: { kedaung: 6000, umum: 7000 },
      setrika_saja: { kedaung: 8000, umum: 10000 },
    },
  },
  express_kilat: {
    estimation_days: 0,
    prices: {
      cuci_setrika: { kedaung: 12000, umum: 14000 },
      cuci_lipat: { kedaung: 8000, umum: 9000 },
      setrika_saja: { kedaung: 10000, umum: 12000 },
    },
  },
};

const STORAGE_KEY = 'berkah_laundry_price_matrix_v1';

// Get current active price matrix (checks localStorage overrides, falls back to default)
export const getActivePriceMatrix = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.reguler && parsed.express && parsed.express_kilat) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load custom price matrix from storage:', err);
  }
  return DEFAULT_PRICE_MATRIX;
};

// Save custom price matrix
export const saveActivePriceMatrix = (matrix) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
  } catch (err) {
    console.error('Failed to save price matrix to storage:', err);
  }
};

// Reset to default
export const resetActivePriceMatrix = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to reset price matrix:', err);
  }
  return DEFAULT_PRICE_MATRIX;
};

// Get unit price for a given service, package, and customer tier
export const getUnitPricePerKg = (service = 'reguler', packageType = 'cuci_setrika', tier = 'kedaung', matrix = null) => {
  const currentMatrix = matrix || getActivePriceMatrix();
  const srv = currentMatrix[service] || currentMatrix.reguler;
  const pkgPrices = srv?.prices?.[packageType] || srv?.prices?.cuci_setrika;
  const normalizedTier = tier === 'luar_kedaung' || tier === 'umum' || tier === 'mm_ambil' ? 'umum' : 'kedaung';
  
  return pkgPrices?.[normalizedTier] || 8000;
};

// Format currency
export const formatRupiah = (val) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(val) || 0);
};

// Get human readable labels
export const getServiceLabel = (service) => {
  return SERVICES[service]?.name || service;
};

export const getServiceDurationLabel = (service) => {
  return SERVICES[service]?.durationLabel || '';
};

export const getPackageLabel = (pkg) => {
  return PACKAGES[pkg]?.name || (pkg === 'cuci_saja' ? 'Cuci Saja (Legacy)' : pkg);
};

export const getCustomerTierLabel = (tier) => {
  const normalized = tier === 'luar_kedaung' || tier === 'umum' || tier === 'mm_ambil' ? 'umum' : 'kedaung';
  return CUSTOMER_TIERS[normalized]?.name || 'Warga Kedaung';
};

export const getCustomerTierShortLabel = (tier) => {
  const normalized = tier === 'luar_kedaung' || tier === 'umum' || tier === 'mm_ambil' ? 'umum' : 'kedaung';
  return CUSTOMER_TIERS[normalized]?.shortName || 'Kedaung';
};

// Robust customer tier extractor that supports both database column and fallback tag
export const extractCustomerTier = (customer) => {
  if (!customer) return 'kedaung';
  if (customer.customer_tier) {
    return customer.customer_tier === 'umum' || customer.customer_tier === 'luar_kedaung' || customer.customer_tier === 'mm_ambil' ? 'umum' : 'kedaung';
  }
  if (customer.location_description) {
    if (customer.location_description.includes('[Kategori: umum]') || customer.location_description.includes('[Kategori: luar_kedaung]') || customer.location_description.includes('[Kategori: mm_ambil]')) {
      return 'umum';
    }
    if (customer.location_description.includes('[Kategori: kedaung]')) {
      return 'kedaung';
    }
  }
  return 'kedaung';
};

export const formatLocationDescriptionWithTier = (description, tier = 'kedaung') => {
  const cleanDesc = (description || '').replace(/\[Kategori:\s*(kedaung|umum|luar_kedaung|mm_ambil)\]/gi, '').trim();
  const tag = `[Kategori: ${tier}]`;
  return cleanDesc ? `${tag} ${cleanDesc}` : tag;
};

export const getCleanLocationDescription = (description) => {
  if (!description) return '';
  return description.replace(/\[Kategori:\s*(kedaung|umum|luar_kedaung|mm_ambil)\]/gi, '').trim();
};
