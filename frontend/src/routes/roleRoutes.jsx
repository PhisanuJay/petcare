import { Route } from 'react-router-dom';

import PetOwnerDashboardPage from '../features/pet-owner/pages/Dashboard.jsx';
import MyPetsPage from '../features/pet-owner/pages/MyPets.jsx';
import ServicesPage from '../features/pet-owner/pages/Services.jsx';
import BookingPage from '../features/pet-owner/pages/Booking.jsx';
import MedicalPage from '../features/pet-owner/pages/Medical.jsx';
import CatHotelPage from '../features/pet-owner/pages/CatHotel.jsx';
import TransportPage from '../features/pet-owner/pages/Transport.jsx';
import PetOwnerAdoptionPage from '../features/pet-owner/pages/Adoption.jsx';
import PetOwnerCctvPage from '../features/pet-owner/pages/Cctv.jsx';

import VeterinarianDashboardPage from '../features/veterinarian/pages/Dashboard.jsx';
import VetAppointmentsPage from '../features/veterinarian/pages/Appointments.jsx';
import VetPatientsPage from '../features/veterinarian/pages/Patients.jsx';
import MedicalRecordsPage from '../features/veterinarian/pages/MedicalRecords.jsx';
import VaccinationPage from '../features/veterinarian/pages/Vaccination.jsx';
import VetReportsPage from '../features/veterinarian/pages/Reports.jsx';

import MedicalAssistantDashboardPage from '../features/medical-assistant/pages/Dashboard.jsx';
import MaAppointmentsPage from '../features/medical-assistant/pages/Appointments.jsx';
import MaPatientsPage from '../features/medical-assistant/pages/Patients.jsx';
import BookingManagementPage from '../features/medical-assistant/pages/BookingManagement.jsx';
import MedicalSupportPage from '../features/medical-assistant/pages/MedicalSupport.jsx';

import PetProfile from '../features/pet-profile/PetProfile.jsx';

import PetHotelDashboardPage from '../features/pet-hotel/pages/Dashboard.jsx';
import RoomsPage from '../features/pet-hotel/pages/Rooms.jsx';
import ReservationsPage from '../features/pet-hotel/pages/Reservations.jsx';
import CheckInOutPage from '../features/pet-hotel/pages/CheckInOut.jsx';
import HotelPetsPage from '../features/pet-hotel/pages/Pets.jsx';
import CareRecordsPage from '../features/pet-hotel/pages/CareRecords.jsx';
import HotelCctvPage from '../features/pet-hotel/pages/Cctv.jsx';

import PetTransportDashboardPage from '../features/pet-transport/pages/Dashboard.jsx';
import AssignedJobsPage from '../features/pet-transport/pages/AssignedJobs.jsx';
import JobDetailPage from '../features/pet-transport/pages/JobDetail.jsx';
import TrackingPage from '../features/pet-transport/pages/Tracking.jsx';
import HistoryPage from '../features/pet-transport/pages/History.jsx';

import AdoptionDashboardPage from '../features/adoption/pages/Dashboard.jsx';
import AnimalsPage from '../features/adoption/pages/Animals.jsx';
import AddAnimalPage from '../features/adoption/pages/AddAnimal.jsx';
import AdoptionRequestsPage from '../features/adoption/pages/AdoptionRequests.jsx';
import RequestDetailPage from '../features/adoption/pages/RequestDetail.jsx';

import AdminDashboardPage from '../features/admin/pages/Dashboard.jsx';
import AdminUsersPage from '../features/admin/pages/Users.jsx';
import AdminProvidersPage from '../features/admin/pages/Providers.jsx';
import AdminBookingsPage from '../features/admin/pages/Bookings.jsx';
import AdminReportsPage from '../features/admin/pages/Reports.jsx';

import SuperAdminDashboardPage from '../features/super-admin/pages/Dashboard.jsx';
import SuperAdminUsersPage from '../features/super-admin/pages/Users.jsx';
import RolesPermissionsPage from '../features/super-admin/pages/RolesPermissions.jsx';
import SuperAdminProvidersPage from '../features/super-admin/pages/Providers.jsx';
import PricingPage from '../features/super-admin/pages/Pricing.jsx';
import PromotionsPage from '../features/super-admin/pages/Promotions.jsx';
import SuperAdminReportsPage from '../features/super-admin/pages/Reports.jsx';
import SettingsPage from '../features/super-admin/pages/Settings.jsx';

/**
 * Route map aligned with Page 17 sitemap.
 * Keep each role under its own path prefix so teams do not overlap.
 */
export const roleRoutes = (
  <>
    {/* Pet Owner — มะแอ่ว */}
    <Route path="pet-owner">
      <Route index element={<PetOwnerDashboardPage />} />
      <Route path="my-pets" element={<MyPetsPage />} />
      <Route path="services" element={<ServicesPage />} />
      <Route path="booking" element={<BookingPage />} />
      <Route path="medical" element={<MedicalPage />} />
      <Route path="cat-hotel" element={<CatHotelPage />} />
      <Route path="transport" element={<TransportPage />} />
      <Route path="adoption" element={<PetOwnerAdoptionPage />} />
      <Route path="cctv" element={<PetOwnerCctvPage />} />
    </Route>

    {/* Veterinarian — มะแอ่ว */}
    <Route path="veterinarian">
      <Route index element={<VeterinarianDashboardPage />} />
      <Route path="appointments" element={<VetAppointmentsPage />} />
      <Route path="patients" element={<VetPatientsPage />} />
      <Route path="medical-records" element={<MedicalRecordsPage />} />
      <Route path="vaccination" element={<VaccinationPage />} />
      <Route path="reports" element={<VetReportsPage />} />
    </Route>

    {/* Medical Assistant — เอิร์ท */}
    <Route path="medical-assistant">
      <Route index element={<MedicalAssistantDashboardPage />} />
      <Route path="appointments" element={<MaAppointmentsPage />} />
      <Route path="patients" element={<MaPatientsPage />} />
      <Route path="booking-management" element={<BookingManagementPage />} />
      <Route path="medical-support" element={<MedicalSupportPage />} />
    </Route>

    {/* Pet Profile (shared) — เอิร์ท, ปร่ย */}
    <Route path="pet-profile" element={<PetProfile />} />

    {/* Pet Hotel — ฟ่าง, เจ */}
    <Route path="pet-hotel">
      <Route index element={<PetHotelDashboardPage />} />
      <Route path="rooms" element={<RoomsPage />} />
      <Route path="reservations" element={<ReservationsPage />} />
      <Route path="check-in-out" element={<CheckInOutPage />} />
      <Route path="pets" element={<HotelPetsPage />} />
      <Route path="care-records" element={<CareRecordsPage />} />
      <Route path="cctv" element={<HotelCctvPage />} />
    </Route>

    {/* Pet Transport — โมเดล */}
    <Route path="pet-transport">
      <Route index element={<PetTransportDashboardPage />} />
      <Route path="assigned-jobs" element={<AssignedJobsPage />} />
      <Route path="job-detail" element={<JobDetailPage />} />
      <Route path="tracking" element={<TrackingPage />} />
      <Route path="history" element={<HistoryPage />} />
    </Route>

    {/* Adoption — ปร่ย */}
    <Route path="adoption">
      <Route index element={<AdoptionDashboardPage />} />
      <Route path="animals" element={<AnimalsPage />} />
      <Route path="add-animal" element={<AddAnimalPage />} />
      <Route path="requests" element={<AdoptionRequestsPage />} />
      <Route path="requests/:requestId" element={<RequestDetailPage />} />
    </Route>

    {/* Admin — เจ */}
    <Route path="admin">
      <Route index element={<AdminDashboardPage />} />
      <Route path="users" element={<AdminUsersPage />} />
      <Route path="providers" element={<AdminProvidersPage />} />
      <Route path="bookings" element={<AdminBookingsPage />} />
      <Route path="reports" element={<AdminReportsPage />} />
    </Route>

    {/* Super Admin — ฟ่าง */}
    <Route path="super-admin">
      <Route index element={<SuperAdminDashboardPage />} />
      <Route path="users" element={<SuperAdminUsersPage />} />
      <Route path="roles-permissions" element={<RolesPermissionsPage />} />
      <Route path="providers" element={<SuperAdminProvidersPage />} />
      <Route path="pricing" element={<PricingPage />} />
      <Route path="promotions" element={<PromotionsPage />} />
      <Route path="reports" element={<SuperAdminReportsPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
  </>
);
