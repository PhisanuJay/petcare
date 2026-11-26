/** Scroll embedded hub wizards so the progress head + step pills sit near the top of the viewport. */
export function scrollHubWizardIntoView(behavior = 'smooth') {
  const progress = document.querySelector('.booking-hub__progress-head');
  const transportSteps = document.querySelector('.booking-hub__panel .tp-wizard-steps-wrap');
  const stayWizard = document.querySelector('.book-sheet--hub .stay-hub-wizard');
  const target = progress || transportSteps || stayWizard;
  if (!target) return;
  const offset = 16;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior });
}