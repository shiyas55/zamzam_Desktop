export interface BrandConfig {
  shopName: string;
  fullName: string;
  tagline: string;
  initials: string;
  phone: string;         // ← Update with real business phone
  routes: string[];
}

export const BRAND_CONFIG: BrandConfig = {
  shopName: 'ZAMZAM FOODS',
  fullName: 'Zamzam Foods Wholesale',
  tagline: 'Wholesale Kubbus & Romali Distribution',
  initials: 'Z',
  phone: '+91 98470 12345',  // ← Update this with your real business phone
  routes: ['Pandikkad', 'Perundurai', 'Melattur'],
};
