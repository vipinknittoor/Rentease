export interface Tenant {
  id: number;

  // Registered User
  user_id: number | null;

  full_name: string;
  phone: string;
  email: string;

  room_number: string;
  room_id: number | null;

  monthly_rent: number;
  deposit: number | null;

  join_date: string;
  status: string;

  // Meter Readings
  previous_reading: number;
  current_reading: number;

  // Calculated
  electricity_units: number;
  electricity_bill: number;

  // NEW: Extra Bill
  extra_bill: number;
  billing_ready: boolean;
  
  billing_enabled: boolean;


}