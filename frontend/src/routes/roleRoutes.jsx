import { Navigate, Route } from 'react-router-dom';

import RequireStaff from '../features/auth/RequireStaff.jsx';

import PetOwnerDashboardPage from '../features/pet-owner/pages/Dashboard.jsx';
import MyPetsPage from '../features/pet-owner/pages/MyPets.jsx';
import PetFormPage from '../features/pet-owner/pages/PetForm.jsx';
import PetDetailPage from '../features/pet-owner/pages/PetDetail.jsx';
import ServicesPage from '../features/pet-owner/pages/Services.jsx';
import BookingPage from '../features/pet-owner/pages/Booking.jsx';
import MedicalPage from '../features/pet-owner/pages/Medical.jsx';
import CatHotelPage, { CatHotelBookingsPage, StayBookPage, StayWatchPage } from '../features/pet-owner/pages/CatHotel.jsx';
import PaymentPage from '../features/payments/PaymentPage.jsx';
import BookingHistoryPage from '../features/payments/BookingHistory.jsx';
import TransportPage from '../features/pet-owner/pages/Transport.jsx';
import TransportHistoryPage from '../features/pet-owner/pages/TransportHistory.jsx';
import TransportDetailPage from '../features/pet-owner/pages/TransportDetail.jsx';
import PetOwnerAdoptionPage from '../features/pet-owner/pages/Adoption.jsx';
import PetOwnerCctvPage from '../features/pet-owner/pages/Cctv.jsx';

import VeterinarianDashboardPage from '../features/veterinarian/pages/Dashboard.jsx';
import VetAppointmentsPage from '../features/veterinarian/pages/Appointments.jsx';
import VetPatientsPage from '../features/veterinarian/pages/Patients.jsx';
import MedicalRecordsPage from '../features/veterinarian/pages/MedicalRecords.jsx';
import VaccinationPage from '../features/veterinarian/pages/Vaccination.jsx';
import VetReportsPage from '../features/veterinarian/pages/Reports.jsx';

import MedicalAssistantLayout from '../features/medical-assistant/layout/MedicalAssistantLayout.jsx';
import MedicalAssistantDashboardPage from '../features/medical-assistant/pages/Dashboard.jsx';
import MaAppointmentsPage from '../features/medical-assistant/pages/Appointments.jsx';
import MaPatientsPage from '../features/medical-assistant/pages/Patients.jsx';
import MaPatientDetailPage from '../features/medical-assistant/pages/PatientDetail.jsx';
import BookingManagementPage from '../features/medical-assistant/pages/BookingManagement.jsx';
import MedicalSupportPage from '../features/medical-assistant/pages/MedicalSupport.jsx';
import SupportCasePage from '../features/medical-assistant/pages/SupportCase.jsx';

import ClinicAdminLayout from '../features/clinic-admin/layout/ClinicAdminLayout.jsx';
import ClinicAdminOverviewPage from '../features/clinic-admin/pages/Overview.jsx';
import ClinicAdminStaffPage from '../features/clinic-admin/pages/Staff.jsx';
import ClinicAdminSchedulePage from '../features/clinic-admin/pages/Schedule.jsx';
import ClinicAdminSettingsPage from '../features/clinic-admin/pages/Settings.jsx';
import ClinicAdminReportsPage from '../features/clinic-admin/pages/Reports.jsx';

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
import DriverProfilePage from '../features/pet-transport/pages/DriverProfile.jsx';
import DriverNotificationsPage from '../features/pet-transport/pages/DriverNotifications.jsx';
import AdminTransportLayout from '../features/pet-transport/admin/AdminTransportLayout.jsx';
import TransportDashboard from '../features/pet-transport/admin/TransportDashboard.jsx';
import BookingManagement from '../features/pet-transport/admin/BookingManagement.jsx';
import BookingAdminDetail from '../features/pet-transport/admin/BookingAdminDetail.jsx';
import PaymentVerification from '../features/pet-transport/admin/PaymentVerification.jsx';
import CancellationPage from '../features/pet-transport/admin/CancellationPage.jsx';
import TransportPricingPage from '../features/pet-transport/admin/PricingPage.jsx';
import HotelsPage from '../features/pet-transport/admin/HotelsPage.jsx';
import DriversPage from '../features/pet-transport/admin/DriversPage.jsx';

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

/* Super Admin (ฟ่าง) = Pet Hotel CCTV — mounted in App.jsx at /super-admin/* */

/**
 * Route map aligned with Page 17 sitemap.
 * Keep each role under its own path prefix so teams do not overlap.
 */

/** Pet Owner — มะแอ่ว. Rendered inside CustomerLayout and requires login (see App.jsx). */
export const petOwnerRoutes = (
  <Route path="pet-owner">
    <Route index element={<PetOwnerDashboardPage />} />
    <Route path="my-pets" element={<MyPetsPage />} />
    <Route path="my-pets/new" element={<PetFormPage />} />
    <Route path="my-pets/:petId" element={<PetDetailPage />} />
    <Route path="my-pets/:petId/edit" element={<PetFormPage />} />
    <Route path="services" element={<ServicesPage />} />
    <Route path="booking" element={<BookingPage />} />
    <Route path="medical" element={<MedicalPage />} />
    <Route path="history" element={<BookingHistoryPage />} />
    <Route path="pay/:paymentId" element={<PaymentPage />} />
    <Route path="cat-hotel" element={<CatHotelPage />} />
    <Route path="cat-hotel/book" element={<StayBookPage />} />
    <Route path="cat-hotel/bookings" element={<CatHotelBookingsPage />} />
    <Route path="cat-hotel/watch/:cameraId" element={<StayWatchPage />} />
    <Route path="transport" element={<TransportPage />} />
    <Route path="transport/history" element={<TransportHistoryPage />} />
    <Route path="transport/:bookingId" element={<TransportDetailPage />} />
    <Route path="adoption" element={<PetOwnerAdoptionPage />} />
    <Route path="cctv" element={<PetOwnerCctvPage />} />
  </Route>
);

/** Admin routes — nested under `/admin` + StaffShell + RequireRole(admin). */
export const adminTransportRoutes = (
  <>
    <Route index element={<Navigate to="transport" replace />} />
    <Route path="transport" element={<AdminTransportLayout />}>
      <Route index element={<TransportDashboard />} />
      <Route path="bookings" element={<BookingManagement />} />
      <Route path="bookings/:bookingId" element={<BookingAdminDetail />} />
      <Route path="cancellations" element={<CancellationPage />} />
      <Route path="pricing" element={<TransportPricingPage />} />
      <Route path="hotels" element={<HotelsPage />} />
      <Route path="drivers" element={<DriversPage />} />
    </Route>
    <Route path="users" element={<AdminUsersPage />} />
    <Route path="providers" element={<AdminProvidersPage />} />
    <Route path="bookings" element={<AdminBookingsPage />} />
    <Route path="reports" element={<AdminReportsPage />} />
    <Route path="dashboard" element={<AdminDashboardPage />} />
  </>
);

/** Driver routes — nested under `/pet-transport` + StaffShell + RequireRole(driver). */
export const driverTransportRoutes = (
  <>
    <Route index element={<PetTransportDashboardPage />} />
    <Route path="assigned-jobs" element={<AssignedJobsPage />} />
    <Route path="job-detail" element={<JobDetailPage />} />
    <Route path="jobs/:tripId" element={<JobDetailPage />} />
    <Route path="jobs/:tripId/status" element={<TrackingPage />} />
    <Route path="tracking" element={<TrackingPage />} />
    <Route path="history" element={<HistoryPage />} />
    <Route path="notifications" element={<DriverNotificationsPage />} />
    <Route path="profile" element={<DriverProfilePage />} />
  </>
);

/** Finance routes — nested under `/finance` + StaffShell + RequireRole(finance). */
export const financeRoutes = (
  <>
    <Route index element={<PaymentVerification />} />
    <Route path="payments" element={<PaymentVerification />} />
  </>
);

/** Legacy skeleton modules (other teams) — not mounted in App until they add auth. */
export const roleRoutes = (
  <>
<<<<<<< HEAD
    <Route path="veterinarian">
=======
    {/* Veterinarian — มะแอ่ว */}
    <Route path="veterinarian" element={<RequireStaff role="veterinarian" />}>
>>>>>>> origin/Pet-Owner-Vet
      <Route index element={<VeterinarianDashboardPage />} />
      <Route path="appointments" element={<VetAppointmentsPage />} />
      <Route path="patients" element={<VetPatientsPage />} />
      <Route path="medical-records" element={<MedicalRecordsPage />} />
      <Route path="vaccination" element={<VaccinationPage />} />
      <Route path="reports" element={<VetReportsPage />} />
    </Route>
<<<<<<< HEAD
    <Route path="medical-assistant">
      <Route index element={<MedicalAssistantDashboardPage />} />
      <Route path="appointments" element={<MaAppointmentsPage />} />
      <Route path="patients" element={<MaPatientsPage />} />
      <Route path="booking-management" element={<BookingManagementPage />} />
      <Route path="medical-support" element={<MedicalSupportPage />} />
=======

    {/* Medical Assistant — เอิร์ท */}
    <Route path="medical-assistant" element={<RequireStaff role="medical_assistant" />}>
      <Route element={<MedicalAssistantLayout />}>
        <Route index element={<MedicalAssistantDashboardPage />} />
        <Route path="appointments" element={<MaAppointmentsPage />} />
        <Route path="patients" element={<MaPatientsPage />} />
        <Route path="patients/:patientId" element={<MaPatientDetailPage />} />
        <Route path="booking-management" element={<BookingManagementPage />} />
        <Route path="medical-support" element={<MedicalSupportPage />} />
        <Route path="medical-support/:appointmentId" element={<SupportCasePage />} />
      </Route>
    </Route>

    {/* Clinic Admin — เอิร์ท */}
    <Route path="clinic-admin" element={<RequireStaff role="clinic_admin" />}>
      <Route element={<ClinicAdminLayout />}>
        <Route index element={<ClinicAdminOverviewPage />} />
        <Route path="staff" element={<ClinicAdminStaffPage />} />
        <Route path="schedule" element={<ClinicAdminSchedulePage />} />
        <Route path="settings" element={<ClinicAdminSettingsPage />} />
        <Route path="reports" element={<ClinicAdminReportsPage />} />
      </Route>
>>>>>>> origin/Pet-Owner-Vet
    </Route>
    <Route path="pet-profile" element={<PetProfile />} />
    <Route path="pet-hotel">
      <Route index element={<PetHotelDashboardPage />} />
      <Route path="rooms" element={<RoomsPage />} />
      <Route path="reservations" element={<ReservationsPage />} />
      <Route path="check-in-out" element={<CheckInOutPage />} />
      <Route path="pets" element={<HotelPetsPage />} />
      <Route path="care-records" element={<CareRecordsPage />} />
      <Route path="cctv" element={<HotelCctvPage />} />
    </Route>
    <Route path="adoption">
      <Route index element={<AdoptionDashboardPage />} />
      <Route path="animals" element={<AnimalsPage />} />
      <Route path="add-animal" element={<AddAnimalPage />} />
      <Route path="requests" element={<AdoptionRequestsPage />} />
      <Route path="requests/:requestId" element={<RequestDetailPage />} />
    </Route>
    {/* Super Admin CCTV → App.jsx /super-admin/* (HotelCctvMount) */}
    {/* Admin transport → adminTransportRoutes under StaffShell */}
  </>
);
