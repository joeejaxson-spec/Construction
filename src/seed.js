'use strict';
// Starter content written on first run. Every entry is a placeholder:
// edit or replace it from the admin panel (/admin) before going live.

const services = [
  {
    slug: 'residential-construction',
    title: 'Residential Construction',
    icon: 'home',
    summary: 'Custom homes and additions built to your plans, on schedule and on budget.',
    description:
      'From the first site survey to the final walkthrough, we manage every trade on your custom home or addition.\n\nWe work from your architect’s drawings or bring our own design partners, pull every permit, and keep you updated with a weekly progress report so you always know where the build stands.',
  },
  {
    slug: 'commercial-construction',
    title: 'Commercial Construction',
    icon: 'building',
    summary: 'Offices, retail and light-industrial buildings delivered with minimal disruption.',
    description:
      'We build ground-up commercial space and complete tenant fit-outs for offices, shops, clinics and warehouses.\n\nOur site teams plan around your operating hours, phase the work to keep businesses open, and hand over complete close-out documentation.',
  },
  {
    slug: 'renovation-remodeling',
    title: 'Renovation & Remodeling',
    icon: 'hammer',
    summary: 'Kitchens, bathrooms, basements and whole-home renovations done cleanly.',
    description:
      'Renovations are about protecting what you already have. We seal off work zones, control dust, and finish each phase before opening the next.\n\nKitchens, bathrooms, basements, structural openings and full interior remodels are all handled by one accountable team.',
  },
  {
    slug: 'design-build',
    title: 'Design-Build',
    icon: 'ruler',
    summary: 'One contract for design and construction, with one team accountable for both.',
    description:
      'With design-build, the people drawing your project are the people pricing and building it. That means fewer change orders, earlier cost certainty and a faster path from idea to keys.\n\nWe start with a feasibility review and a target budget, then develop the design alongside live pricing.',
  },
  {
    slug: 'project-management',
    title: 'Project Management',
    icon: 'clipboard',
    summary: 'Scheduling, budgeting and subcontractor coordination from day one to handover.',
    description:
      'Already have a design and a budget? Our project managers run the schedule, procurement, inspections and subcontractor coordination for you.\n\nYou get a single point of contact, transparent cost tracking and a documented handover.',
  },
  {
    slug: 'concrete-foundations',
    title: 'Concrete & Foundations',
    icon: 'layers',
    summary: 'Footings, slabs, retaining walls and structural concrete poured right the first time.',
    description:
      'Everything above ground depends on what goes in below it. Our crews handle excavation, footings, foundation walls, slabs, driveways and retaining walls.\n\nEvery pour is inspected and documented before we backfill.',
  },
];

const projects = [
  {
    slug: 'maple-ridge-residence',
    title: 'Maple Ridge Residence',
    category: 'Residential',
    location: 'Maple Ridge',
    year: 2025,
    size: '4,200 sq ft',
    duration: '11 months',
    status: 'completed',
    featured: true,
    summary: 'A two-storey custom home with an open timber-frame great room and a walk-out lower level.',
    description:
      'This custom home sits on a sloped lot, so the build started with a stepped foundation and a full walk-out lower level.\n\nThe great room uses exposed timber framing with a 22-foot ceiling, and the envelope was built to a high-efficiency standard with continuous exterior insulation.\n\n(Sample project: replace with your own work from the admin panel.)',
  },
  {
    slug: 'harbor-street-offices',
    title: 'Harbor Street Offices',
    category: 'Commercial',
    location: 'Downtown',
    year: 2024,
    size: '18,000 sq ft',
    duration: '14 months',
    status: 'completed',
    featured: true,
    summary: 'A three-storey steel-frame office building with ground-floor retail.',
    description:
      'A three-storey steel-frame office building with ground-floor retail units and a rooftop terrace.\n\nThe tight downtown site meant just-in-time deliveries and a carefully phased crane plan.\n\n(Sample project: replace with your own work from the admin panel.)',
  },
  {
    slug: 'oak-lane-kitchen',
    title: 'Oak Lane Kitchen & Living',
    category: 'Renovation',
    location: 'Oak Lane',
    year: 2025,
    size: '900 sq ft',
    duration: '10 weeks',
    status: 'completed',
    featured: true,
    summary: 'A load-bearing wall removed to open the kitchen and living room into one space.',
    description:
      'We removed a load-bearing wall and installed an engineered beam to merge the kitchen and living room.\n\nNew cabinetry, a large island, updated electrical and refinished oak floors completed the space while the family lived at home.\n\n(Sample project: replace with your own work from the admin panel.)',
  },
  {
    slug: 'northgate-distribution-center',
    title: 'Northgate Distribution Center',
    category: 'Industrial',
    location: 'Northgate Industrial Park',
    year: 2023,
    size: '62,000 sq ft',
    duration: '9 months',
    status: 'completed',
    featured: false,
    summary: 'A tilt-up concrete warehouse with 12 loading docks and a mezzanine office.',
    description:
      'Tilt-up concrete panels were cast on site and lifted into place in under three weeks.\n\nThe building includes 12 dock-high doors, a mezzanine office and a reinforced slab rated for heavy racking.\n\n(Sample project: replace with your own work from the admin panel.)',
  },
  {
    slug: 'cedar-court-townhomes',
    title: 'Cedar Court Townhomes',
    category: 'Residential',
    location: 'Cedar Court',
    year: 2026,
    size: '8 units',
    duration: '16 months',
    status: 'in-progress',
    featured: true,
    summary: 'Eight three-bedroom townhomes with private garages and rooftop decks.',
    description:
      'Eight three-bedroom townhomes arranged around a shared courtyard, each with a private garage and rooftop deck.\n\nFraming is complete and interior finishes are under way.\n\n(Sample project: replace with your own work from the admin panel.)',
  },
  {
    slug: 'riverside-clinic-fitout',
    title: 'Riverside Clinic Fit-Out',
    category: 'Commercial',
    location: 'Riverside',
    year: 2024,
    size: '6,500 sq ft',
    duration: '5 months',
    status: 'completed',
    featured: false,
    summary: 'A medical clinic tenant improvement with exam rooms, imaging and accessible washrooms.',
    description:
      'A full tenant improvement turning an empty retail shell into a working medical clinic.\n\nThe scope included 14 exam rooms, a lead-lined imaging room, upgraded HVAC and fully accessible washrooms.\n\n(Sample project: replace with your own work from the admin panel.)',
  },
  {
    slug: 'hillcrest-basement-suite',
    title: 'Hillcrest Basement Suite',
    category: 'Renovation',
    location: 'Hillcrest',
    year: 2025,
    size: '1,100 sq ft',
    duration: '8 weeks',
    status: 'completed',
    featured: false,
    summary: 'An unfinished basement turned into a legal one-bedroom suite with a separate entrance.',
    description:
      'We underpinned one wall, added a separate exterior entrance and egress windows, and finished the space as a one-bedroom suite.\n\nAll work was permitted and inspected to meet secondary-suite requirements.\n\n(Sample project: replace with your own work from the admin panel.)',
  },
  {
    slug: 'westfield-retaining-wall',
    title: 'Westfield Retaining Wall',
    category: 'Industrial',
    location: 'Westfield',
    year: 2023,
    size: '240 linear ft',
    duration: '6 weeks',
    status: 'completed',
    featured: false,
    summary: 'An engineered cast-in-place retaining wall stabilizing a commercial parking lot.',
    description:
      'An engineered cast-in-place concrete retaining wall up to 12 feet high, with drainage and a safety rail, stabilizing a commercial parking lot above a creek bank.\n\n(Sample project: replace with your own work from the admin panel.)',
  },
];

module.exports = { services, projects };
