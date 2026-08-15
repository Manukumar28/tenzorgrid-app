// Bundled skills list used for (a) the onboarding skills autosuggestion field and
// (b) CV-parsing heuristic matching. Not exhaustive — a reasonable v1 starter set
// across tech, business, design, and general professional skills.
const SKILLS = [
  // Programming languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby',
  'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'SQL', 'Bash / Shell scripting',
  // Frontend
  'React', 'Angular', 'Vue.js', 'Next.js', 'HTML', 'CSS', 'Tailwind CSS', 'Redux',
  'Webpack', 'Responsive design',
  // Backend
  'Node.js', 'Express.js', 'Django', 'Flask', 'Spring Boot', '.NET', 'REST APIs',
  'GraphQL', 'gRPC', 'Microservices',
  // Data & databases
  'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Data modeling',
  'Data warehousing', 'ETL pipelines', 'Apache Kafka', 'Apache Spark',
  // Cloud & DevOps
  'AWS', 'Azure', 'Google Cloud Platform', 'Docker', 'Kubernetes', 'Terraform',
  'CI/CD', 'Jenkins', 'GitHub Actions', 'Linux', 'System design', 'Site reliability',
  'Distributed systems',
  // Data science / AI
  'Machine learning', 'Deep learning', 'Natural language processing', 'Computer vision',
  'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Data analysis', 'Data visualization',
  'Statistics', 'A/B testing', 'Power BI', 'Tableau', 'Excel (advanced)',
  // QA
  'Manual testing', 'Testing (Jest)', 'Test automation', 'Selenium', 'Cypress',
  'Quality assurance',
  // Product & project management
  'Product management', 'Product strategy', 'Roadmapping', 'Agile', 'Scrum', 'Kanban',
  'Jira', 'Project management', 'Stakeholder management', 'Requirements gathering',
  'User research', 'A/B testing',
  // Design
  'UI design', 'UX design', 'Figma', 'Adobe Photoshop', 'Adobe Illustrator',
  'Wireframing', 'Prototyping', 'Design systems',
  // Sales & marketing
  'Digital marketing', 'SEO', 'SEM', 'Content marketing', 'Social media marketing',
  'Email marketing', 'Google Analytics', 'Google Ads', 'Meta Ads', 'Brand strategy',
  'Sales', 'Business development', 'Lead generation', 'CRM (Salesforce)', 'HubSpot',
  'Market research', 'Copywriting',
  // Finance & operations
  'Financial modeling', 'Budgeting', 'Forecasting', 'Accounting', 'Bookkeeping',
  'Financial analysis', 'Investment analysis', 'Supply chain management',
  'Operations management', 'Inventory management', 'Procurement', 'Logistics',
  // HR & entrepreneurship
  'Recruiting', 'Talent acquisition', 'Employee onboarding', 'Performance management',
  'HR policy', 'Business strategy', 'Fundraising / Pitching investors',
  'Startup operations', 'Go-to-market strategy', 'Vendor management',
  // Leadership / soft skills
  'Leadership', 'Team management', 'People management', 'Cross-functional collaboration',
  'Communication', 'Public speaking', 'Negotiation', 'Problem solving',
  'Critical thinking', 'Time management', 'Mentoring', 'Strategic planning',
  'Client relationship management', 'Conflict resolution',
];

module.exports = { SKILLS };
