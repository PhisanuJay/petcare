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

/** Customer landing page (Soft Blue Pastel, based on clinic-home-mockup/design-2). */
export default function HomePage() {
  const { go, modal } = useMemberLink();

  return (
    <>
      <HeroSection go={go} />
      <AboutSection />
      <ServicesSection />
      <HotelSection go={go} />
      <AdoptionSection go={go} />
      <WhySection />
      <VetsSection />
      <PromoSection go={go} />
      <ReviewsSection />
      <ContactSection />
      {modal}
    </>
  );
}
