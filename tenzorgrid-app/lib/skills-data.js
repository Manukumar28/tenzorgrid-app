// Bundled skills list used for (a) the onboarding skills autosuggestion field and
// (b) CV-parsing heuristic matching. Not exhaustive — a reasonable v1 starter set
// across tech, business, design, and general professional skills. Organized into
// categories so the onboarding UI can group suggestions instead of one flat list.
const SKILL_CATEGORIES = [
  {
    category: 'Programming languages',
    skills: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'SQL', 'Bash / Shell scripting'],
  },
  {
    category: 'Frontend',
    skills: ['React', 'Angular', 'Vue.js', 'Next.js', 'HTML', 'CSS', 'Tailwind CSS', 'Redux', 'Webpack', 'Responsive design'],
  },
  {
    category: 'Backend',
    skills: ['Node.js', 'Express.js', 'Django', 'Flask', 'Spring Boot', '.NET', 'REST APIs', 'GraphQL', 'gRPC', 'Microservices'],
  },
  {
    category: 'Data & databases',
    skills: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Data modeling', 'Data warehousing', 'ETL pipelines', 'Apache Kafka', 'Apache Spark'],
  },
  {
    category: 'Cloud & DevOps',
    skills: ['AWS', 'Azure', 'Google Cloud Platform', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Jenkins', 'GitHub Actions', 'Linux', 'System design', 'Site reliability', 'Distributed systems'],
  },
  {
    category: 'Data science & AI',
    skills: ['Machine learning', 'Deep learning', 'Natural language processing', 'Computer vision', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Data analysis', 'Data visualization', 'Statistics', 'A/B testing', 'Power BI', 'Tableau', 'Excel (advanced)'],
  },
  {
    category: 'QA & testing',
    skills: ['Manual testing', 'Testing (Jest)', 'Test automation', 'Selenium', 'Cypress', 'Quality assurance'],
  },
  {
    category: 'Product & project management',
    skills: ['Product management', 'Product strategy', 'Roadmapping', 'Agile', 'Scrum', 'Kanban', 'Jira', 'Project management', 'Stakeholder management', 'Requirements gathering', 'User research'],
  },
  {
    category: 'Design',
    skills: ['UI design', 'UX design', 'Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'Wireframing', 'Prototyping', 'Design systems'],
  },
  {
    category: 'Sales & marketing',
    skills: ['Digital marketing', 'SEO', 'SEM', 'Content marketing', 'Social media marketing', 'Email marketing', 'Google Analytics', 'Google Ads', 'Meta Ads', 'Brand strategy', 'Sales', 'Business development', 'Lead generation', 'CRM (Salesforce)', 'HubSpot', 'Market research', 'Copywriting'],
  },
  {
    category: 'Finance & operations',
    skills: ['Financial modeling', 'Budgeting', 'Forecasting', 'Accounting', 'Bookkeeping', 'Financial analysis', 'Investment analysis', 'Supply chain management', 'Operations management', 'Inventory management', 'Procurement', 'Logistics'],
  },
  {
    category: 'Accounting & bookkeeping',
    skills: ['Accounts receivable', 'Accounts payable', 'General ledger', 'Payroll', 'Payroll processing', 'Bank reconciliation', 'Reconciliation', 'Auditing', 'Internal audit', 'Tax preparation', 'Tax filing', 'GST filing', 'GAAP', 'IFRS', 'Cost accounting', 'Accounts finalization', 'Invoice processing', 'Journal entries', 'Fixed asset accounting', 'QuickBooks', 'Tally', 'SAP FICO', 'Oracle Financials', 'Zoho Books'],
  },
  {
    category: 'HR & entrepreneurship',
    skills: ['Recruiting', 'Talent acquisition', 'Employee onboarding', 'Performance management', 'HR policy', 'Business strategy', 'Fundraising / Pitching investors', 'Startup operations', 'Go-to-market strategy', 'Vendor management', 'Compensation & benefits', 'Employee relations', 'HRIS', 'Payroll administration', 'Training & development', 'Workforce planning'],
  },
  {
    category: 'Customer service & support',
    skills: ['Customer service', 'Customer support', 'Technical support', 'Help desk', 'Call center operations', 'Ticket management', 'Zendesk', 'Freshdesk', 'Live chat support', 'Complaint resolution', 'Order processing', 'Client onboarding'],
  },
  {
    category: 'Healthcare',
    skills: ['Patient care', 'Clinical documentation', 'Nursing', 'Medical coding', 'Medical billing', 'Electronic health records (EHR)', 'Phlebotomy', 'Pharmacy operations', 'Healthcare administration', 'HIPAA compliance', 'Vital signs monitoring', 'Diagnostic testing'],
  },
  {
    category: 'Legal',
    skills: ['Legal research', 'Contract drafting', 'Contract review', 'Litigation support', 'Compliance', 'Regulatory affairs', 'Paralegal support', 'Corporate law', 'Intellectual property', 'Legal documentation', 'Due diligence'],
  },
  {
    category: 'Education & training',
    skills: ['Curriculum development', 'Lesson planning', 'Classroom management', 'Teaching', 'Tutoring', 'Instructional design', 'E-learning development', 'Student assessment', 'Academic counseling', 'Training delivery'],
  },
  {
    category: 'Retail, hospitality & admin',
    skills: ['Retail sales', 'Merchandising', 'Point of sale (POS) systems', 'Cash handling', 'Front desk operations', 'Hospitality management', 'Event coordination', 'Housekeeping operations', 'Administrative support', 'Office management', 'Data entry', 'Scheduling', 'Travel coordination', 'Microsoft Office (Word, Excel, PowerPoint)'],
  },
  {
    category: 'Manufacturing, construction & trades',
    skills: ['Production planning', 'Quality control', 'Lean manufacturing', 'Six Sigma', 'Warehouse operations', 'Machine operation', 'Assembly line operations', 'Construction management', 'Electrical work', 'Plumbing', 'Welding', 'Safety compliance (EHS)', 'CAD / AutoCAD'],
  },
  {
    category: 'Media & communications',
    skills: ['Content writing', 'Editing & proofreading', 'Journalism', 'Public relations', 'Video editing', 'Photography', 'Social media management', 'Community management', 'Technical writing', 'Translation'],
  },
  {
    category: 'Leadership & soft skills',
    skills: ['Leadership', 'Team management', 'People management', 'Cross-functional collaboration', 'Communication', 'Public speaking', 'Negotiation', 'Problem solving', 'Critical thinking', 'Time management', 'Mentoring', 'Strategic planning', 'Client relationship management', 'Conflict resolution'],
  },
];

const SKILLS = SKILL_CATEGORIES.flatMap((c) => c.skills);

module.exports = { SKILLS, SKILL_CATEGORIES };
