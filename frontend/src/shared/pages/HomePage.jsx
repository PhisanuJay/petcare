import HeroSection from './home/HeroSection.jsx';
import HotelSection from './home/HotelSection.jsx';
import AdoptionSection from './home/AdoptionSection.jsx';
import {
  AboutSection,
  ContactSection,
  PromoSection,
  ReviewsSection,
  ServicesSection,
  VetsSection,
  WhySection,
} from './home/InfoSections.jsx';
import { useMemberLink } from './home/NeedLoginModal.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import BookingHistory from '../../features/payments/BookingHistory.jsx';

/** Customer landing page (Soft Blue Pastel, based on clinic-home-mockup/design-2). */
export default function HomePage() {
  const { go, modal } = useMemberLink();
  const { currentUser } = useAuth();

  return (
    <>
      <HeroSection go={go} />
      {currentUser?.role === 'owner' ? (
        <section className="page-wrap" id="booking-history">
          <div className="container" style={{ paddingTop: 32, paddingBottom: 8 }}>
            <h2 className="mitr" style={{ fontWeight: 500 }}>ประวัติการจอง</h2>
            <p className="text-muted">รวมการจองโรงแรม รับส่ง และนัดคลินิก โดยนัดคลินิกไม่มีมัดจำ</p>
            <BookingHistory embedded />
          </div>
        </section>
      ) : null}
      <AboutSection />
      <ServicesSection />
      <HotelSection go={go} />
      <AdoptionSection />
      <WhySection />
      <VetsSection />
      <PromoSection go={go} />
      <ReviewsSection />
      <ContactSection />
      {modal}
    </>
  );
}
