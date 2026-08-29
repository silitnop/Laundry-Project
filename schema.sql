-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUM TYPES Setup
CREATE TYPE service_type AS ENUM ('reguler', 'express', 'express_kilat');
CREATE TYPE package_type AS ENUM ('cuci_setrika', 'cuci_lipat', 'setrika_saja', 'cuci_saja');
CREATE TYPE price_mode AS ENUM ('per_kg', 'per_satuan');
CREATE TYPE payment_status AS ENUM ('lunas', 'belum_lunas');
CREATE TYPE transaction_status AS ENUM ('belum_diproses', 'diproses', 'selesai', 'sudah_diambil');

-- 2. TABLES Setup

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'kasir' CHECK (role IN ('admin', 'kasir')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Customers
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT NOT NULL,
    location_description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    foto_rumah_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Price List (prices can be edited by admin)
CREATE TABLE public.price_list (
    service service_type PRIMARY KEY,
    price_per_kg NUMERIC NOT NULL DEFAULT 0,
    estimation_days INTEGER NOT NULL, -- 3 for reguler, 1 for express, 0 for express_kilat
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Transactions
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT NOT NULL,
    kasir_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
    service service_type NOT NULL,
    package package_type NOT NULL,
    price_mode price_mode NOT NULL,
    weight NUMERIC(5,2), -- NULL for per_satuan
    item_details TEXT, -- Description of items if per_satuan, or notes
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    payment_status payment_status NOT NULL DEFAULT 'belum_lunas',
    status transaction_status NOT NULL DEFAULT 'belum_diproses',
    estimated_completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TRIGGERS FOR AUTOMATED DATA

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role_val TEXT;
  meta_role TEXT;
BEGIN
  -- Safely extract role from user metadata
  IF new.raw_user_meta_data IS NOT NULL THEN
    meta_role := new.raw_user_meta_data->>'role';
  END IF;

  -- Determine role safely without throwing cast exceptions
  IF meta_role = 'admin' THEN
    user_role_val := 'admin';
  ELSE
    user_role_val := 'kasir';
  END IF;

  INSERT INTO public.profiles (id, name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Kasir Baru'),
    user_role_val
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Automatic Receipt Number generation (LND-YYMMDD-XXXX)
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
    date_str TEXT;
    seq_num INT;
BEGIN
    date_str := to_char(CURRENT_DATE, 'YYMMDD');
    
    -- Lock table row for matching prefix to avoid race conditions in numbering
    SELECT COALESCE(MAX(SUBSTRING(receipt_number FROM 12 FOR 4)::INTEGER), 0) + 1 INTO seq_num
    FROM public.transactions
    WHERE receipt_number LIKE 'LND-' || date_str || '-%';
    
    NEW.receipt_number := 'LND-' || date_str || '-' || lpad(seq_num::text, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_receipt_number
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_receipt_number();

-- Update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_price_list_updated_at
    BEFORE UPDATE ON public.price_list
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Helper function to check if the user is an admin (Security Definer bypasses RLS to prevent recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Allow read profiles for authenticated users" 
    ON public.profiles FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow users to update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Allow admins full access to profiles" 
    ON public.profiles FOR ALL 
    USING (public.is_admin());

-- Customers Policies
CREATE POLICY "Allow read customers for authenticated users" 
    ON public.customers FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert customers for authenticated users" 
    ON public.customers FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update customers for authenticated users" 
    ON public.customers FOR UPDATE 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete customers for admins only" 
    ON public.customers FOR DELETE 
    USING (public.is_admin());

-- Price List Policies
CREATE POLICY "Allow read price_list for authenticated users" 
    ON public.price_list FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admins to edit price_list" 
    ON public.price_list FOR ALL 
    USING (public.is_admin());

-- Transactions Policies
CREATE POLICY "Allow read transactions for authenticated users" 
    ON public.transactions FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert transactions for authenticated users" 
    ON public.transactions FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update transactions for authenticated users" 
    ON public.transactions FOR UPDATE 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete transactions for admins only" 
    ON public.transactions FOR DELETE 
    USING (public.is_admin());


-- 5. SEED DATA
INSERT INTO public.price_list (service, price_per_kg, estimation_days) VALUES
('reguler', 7000, 3),
('express', 10000, 1),
('express_kilat', 15000, 0)
ON CONFLICT (service) DO NOTHING;
