import { Navigate, Route } from 'react-router-dom';
import RequireStaff from '../features/auth/RequireStaff.jsx';
import VeterinarianLayout from '../features/veterinarian/components/VeterinarianLayout.jsx';

import PetOwnerDashboardPage from '../features/pet-owner/pages/Dashboard.jsx';
import MyPetsPage from '../features/pet-owner/pages/MyPets.jsx';
import PetFormPage from '../features/pet-owner/pages/PetForm.jsx';
import PetDetailPage from '../features/pet-owner/pages/PetDetail.jsx';
import ServicesPage from '../features/pet-owner/pages/Services.jsx';
import BookingPage from '../features/pet-owner/pages/Booking.jsx';
import MedicalPage from '../features/pet-owner/pages/Medical.jsx';
import CatHotelPage, { CatHotelBookingsPage, StayBookPage, StayWatchPage } from '../features/pet-owner/pages/CatHotel.jsx';
import CatHotelReservationPage from '../features/pet-owner/pages/CatHotelReservation.jsx';
import HotelBookingDetailPage from '../features/pet-owner/pages/HotelBookingDetail.jsx';
import PaymentPage from '../features/payments/PaymentPage.jsx';
import BookingHistoryPage from '../features/payments/BookingHistory.jsx';
import TransportPage from '../features/pet-owner/pages/Transport.jsx';
import TransportRequestsPage from '../features/pet-owner/pages/TransportRequests.jsx';
import TransportHistoryPage from '../features/pet-owner/pages/TransportHistory.jsx';
import TransportDetailPage from '../features/pet-owner/pages/TransportDetail.jsx';
import AdoptionHub from '../features/adoption/pages/AdoptionHub.jsx';
import PetOwnerCctvPage from '../features/pet-owner/pages/Cctv.jsx';

import VeterinarianDashboardPage from '../features/veterinarian/pages/Dashboard.jsx';
import VetAppointmentsPage from '../features/veterinarian/pages/Appointments.jsx';
import VetPatientsPage from '../features/veterinarian/pages/Patients.jsx';
import MedicalRecordsPage from '../features/veterinarian/pages/MedicalRecords.jsx';
import VaccinationPage from '../features/veterinarian/pages/Vaccination.jsx';
import VetReportsPage from '../features/veterinarian/pages/Reports.jsx';

import MaAppointmentsPage from '../features/medical-assistant/pages/Appointments.jsx';
import MaPatientsPage from '../features/medical-assistant/pages/Patients.jsx';
import MaPatientDetailPage from '../features/medical-assistant/pages/PatientDetail.jsx';

import ClinicAdminLayout from '../features/clinic-admin/layout/ClinicAdminLayout.jsx';
import ClinicAdminOverviewPage from '../features/clinic-admin/pages/Overview.jsx';
import ClinicAdminStaffPage from '../features/clinic-admin/pages/Staff.jsx';
import ClinicAdminSchedulePage from '../features/clinic-admin/pages/Schedule.jsx';
import ClinicAdminSettingsPage from '../features/clinic-admin/pages/Settings.jsx';
import ClinicAdminServicesPage from '../features/clinic-admin/pages/Services.jsx';
import ClinicAdminReportsPage from '../features/clinic-admin/pages/Reports.jsx';

import PetProfile from '../features/pet-profile/PetProfile.jsx';

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
import CancellationPage from '../features/pet-transport/admin/CancellationPage.jsx';
import TransportPricingPage from '../features/pet-transport/admin/PricingPage.jsx';
import DriversPage from '../features/pet-transport/admin/DriversPage.jsx';

import AdoptionDashboardPage from '../features/adoption/pages/Dashboard.jsx';
import AnimalsPage from '../features/adoption/pages/Animals.jsx';
import AddAnimalPage from '../features/adoption/pages/AddAnimal.jsx';
import AdoptionRequestsPage from '../features/adoption/pages/AdoptionRequests.jsx';
import RequestDetailPage from '../features/adoption/pages/RequestDetail.jsx';
import AdoptionHistoryPage from '../features/adoption/pages/AdoptionHistory.jsx';
import AdoptionStaffGate from '../features/adoption/AdoptionStaffGate.jsx';
import AdoptionStaffLayout from '../features/adoption/AdoptionStaffLayout.jsx';

import AdminDashboardPage from '../features/admin/pages/Dashboard.jsx';
import AdminUsersPage from '../features/admin/pages/Users.jsx';
import AdminProvidersPage from '../features/admin/pages/Providers.jsx';
import AdminBookingsPage from '../features/admin/pages/Bookings.jsx';
import AdminReportsPage from '../features/admin/pages/Reports.jsx';

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
    <Route path="cat-hotel/reservations" element={<Navigate to="/pet-owner/cat-hotel/book" replace />} />
    <Route path="cat-hotel/book" element={<StayBookPage />} />
    <Route path="cat-hotel/bookings" element={<CatHotelBookingsPage />} />
    <Route path="cat-hotel/bookings/:bookingId" element={<HotelBookingDetailPage />} />
    <Route path="cat-hotel/watch/:cameraId" element={<StayWatchPage />} />
    <Route path="transport" element={<TransportPage />} />
    <Route path="transport/requests" element={<Navigate to="/pet-owner/transport/history" replace />} />
    <Route path="transport/history" element={<TransportHistoryPage />} />
    <Route path="transport/:bookingId" element={<TransportDetailPage />} />
    <Route path="adoption" element={<AdoptionHub />} />
    <Route path="cctv" element={<PetOwnerCctvPage />} />
  </Route>
);

export const adminTransportRoutes = (
  <>
    <Route path="transport" element={<AdminTransportLayout />}>
      <Route index element={<TransportDashboard />} />
      <Route path="bookings" element={<BookingManagement />} />
      <Route path="bookings/:bookingId" element={<BookingAdminDetail />} />
      <Route path="cancellations" element={<CancellationPage />} />
      <Route path="pricing" element={<TransportPricingPage />} />
      <Route path="drivers" element={<DriversPage />} />
    </Route>
    <Route path="users" element={<AdminUsersPage />} />
    <Route path="providers" element={<AdminProvidersPage />} />
    <Route path="bookings" element={<AdminBookingsPage />} />
    <Route path="reports" element={<AdminReportsPage />} />
    <Route path="dashboard" element={<AdminDashboardPage />} />
  </>
);

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

export const adoptionStaffRoutes = (
  <>
    <Route path="adoption/login" element={<Navigate to="/login?next=/adoption" replace />} />
    <Route element={<AdoptionStaffGate />}>
      <Route path="adoption" element={<AdoptionStaffLayout />}>
        <Route index element={<AdoptionDashboardPage />} />
        <Route path="animals" element={<AnimalsPage />} />
        <Route path="add-animal" element={<AddAnimalPage />} />
        <Route path="requests" element={<AdoptionRequestsPage />} />
        <Route path="requests/:requestId" element={<RequestDetailPage />} />
        <Route path="history" element={<AdoptionHistoryPage />} />
      </Route>
    </Route>
  </>
);

export const roleRoutes = (
  <>
    <Route path="veterinarian" element={<RequireStaff role="veterinarian" />}>
      <Route element={<VeterinarianLayout />}>
        <Route index element={<VeterinarianDashboardPage />} />
        <Route path="appointments" element={<VetAppointmentsPage />} />
        <Route path="patients" element={<VetPatientsPage />} />
        <Route path="medical-records" element={<MedicalRecordsPage />} />
        <Route path="vaccination" element={<VaccinationPage />} />
        <Route path="reports" element={<VetReportsPage />} />
      </Route>
    </Route>
    {/* งานหน้าร้านคลินิกอยู่ใต้แอดมินคลินิก — เลิกมีบทบาทผู้ช่วยฯ แยก */}
    <Route path="clinic-admin" element={<RequireStaff roles={['clinic_admin', 'medical_assistant']} />}>
      <Route element={<ClinicAdminLayout />}>
        <Route index element={<ClinicAdminOverviewPage />} />
        <Route path="appointments" element={<MaAppointmentsPage />} />
        <Route path="booking-management" element={<Navigate to="/clinic-admin/appointments" replace />} />
        <Route path="patients" element={<MaPatientsPage />} />
        <Route path="patients/:patientId" element={<MaPatientDetailPage />} />
        <Route path="medical-support" element={<Navigate to="/clinic-admin/appointments" replace />} />
        <Route path="medical-support/:appointmentId" element={<Navigate to="/clinic-admin/appointments" replace />} />
        <Route path="desk" element={<Navigate to="/clinic-admin" replace />} />
        <Route path="staff" element={<ClinicAdminStaffPage />} />
        <Route path="schedule" element={<ClinicAdminSchedulePage />} />
        <Route path="services" element={<ClinicAdminServicesPage />} />
        <Route path="settings" element={<ClinicAdminSettingsPage />} />
        <Route path="reports" element={<ClinicAdminReportsPage />} />
      </Route>
    </Route>
    <Route path="medical-assistant" element={<Navigate to="/clinic-admin" replace />} />
    <Route path="medical-assistant/*" element={<Navigate to="/clinic-admin" replace />} />
    <Route path="pet-profile" element={<PetProfile />} />
    {/* Legacy pet-hotel staff paths → Hotel Admin shell */}
    <Route path="pet-hotel" element={<Navigate to="/admin/stays" replace />} />
    <Route path="pet-hotel/*" element={<Navigate to="/admin/stays" replace />} />
  </>
);
