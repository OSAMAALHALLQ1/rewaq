import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) || '';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_ANON_KEY) || '';

export const supabase = (supabaseUrl && supabaseUrl !== 'YOUR_SUPABASE_URL') 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
