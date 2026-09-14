// The role catalogue.
//
// 153 roles across 19 business functions, grouped into 6 categories for the enrolment
// picker. This is the list from the "Roles We Can Simulate" study, brought into code so
// there is one source of truth rather than a document and a dropdown that disagree.
//
// Two different questions get asked about a role and they must not be confused:
//
//  1. "Can a learner start it today?" — `status`. Only ever 'live' when the role has an
//     authored project catalogue behind it. Today that is exactly one role. Everything
//     else is 'coming', and the picker says so rather than letting somebody click into
//     an empty workspace.
//  2. "How much would it cost us to build?" — `ready`, computed below from the datasets
//     and graders the role actually needs. The study hard-coded this judgement when two
//     datasets existed; there are five now, so it is derived rather than stored. A role
//     moves from "needs a build" to "ready to author" by itself on the day its dataset
//     lands, and nobody has to remember to update a label.
//
// `datasets` are seeded datasets that EXIST. `needs` are datasets that would have to be
// built first. `graders` are the task graders the role's day would be marked by.

// What lib/datasets.js ships today.
const DATASETS_BUILT = ['hr_core', 'saas_ops', 'product_events', 'retail_sales', 'analytics_ops'];

// What lib/tasktypes.js and lib/charttasks.js can actually mark. `sheet` — a spreadsheet
// grader — is the one missing grader that gates an entire function (finance), and it is
// named here so the roles blocked on it report themselves rather than being guessed at.
const GRADERS_LIVE = ['sql', 'python', 'chart', 'choice', 'writeup'];

// Six categories over the nineteen functions. The functions themselves are unchanged from
// the study — they become subcategories — because re-cutting them would have meant
// re-judging 153 roles for no gain.
const CATEGORIES = [
  { key: 'data_tech', label: 'Data & Technology',
    blurb: 'Query, model, ship and keep it running.',
    subcategories: ['Data & Analytics', 'Technology'] },
  { key: 'business', label: 'Business & Strategy',
    blurb: 'Decide what gets built, and carry the risk of it.',
    subcategories: ['Business, Product & Project', 'Risk, Governance & Corporate'] },
  { key: 'finance', label: 'Finance & Capital Markets',
    blurb: 'The money, the books, and the back office behind them.',
    subcategories: ['Finance & Accounting', 'BFSI Operations', 'Capital Markets & Fund Services'] },
  { key: 'operations', label: 'Operations & Supply Chain',
    blurb: 'Getting things made, moved, stocked and sold.',
    subcategories: ['Operations & Supply Chain', 'Manufacturing, Construction & Facilities', 'Retail, E-commerce & Hospitality'] },
  { key: 'commercial', label: 'People, Sales & Marketing',
    blurb: 'Hiring them, reaching them, keeping them.',
    subcategories: ['HR & People', 'Marketing & Growth', 'Sales & Customer'] },
  { key: 'specialist', label: 'Specialist & Regulated Services',
    blurb: 'Work judged against a rulebook — health, law, safety, content, language.',
    subcategories: ['Healthcare, Life Sciences & Legal', 'Trust, Safety & Content Operations',
      'Legal Process & eDiscovery', 'Sustainability, ESG & Safety', 'Education & Development Sector',
      'Media & Language'] },
];

// Every role gets three rungs — Junior, Senior, Lead. Data Analyst carries a fourth,
// Manager, because its track is authored that deep. A role's ladder is its own: a
// three-rung role tops out at Lead, and the promotion machinery reads the rung list
// rather than assuming four.
const LEVELS_3 = ['junior', 'senior', 'lead'];
const LEVELS_4 = ['junior', 'senior', 'lead', 'manager'];

// The average a learner must hold to be put up for the next rung. Index n is the bar for
// moving OFF level n — so a three-rung role uses the first two and never the third.
const LEVEL_BARS = [75, 80, 85];

const ROLES = [];
function role(subcategory, label, key, datasets, needs, graders, note, extra) {
  ROLES.push(Object.assign({
    key, label, subcategory, datasets, needs, graders, note,
    levels: LEVELS_4.slice(0, 3),
    status: 'coming',
  }, extra || {}));
}

// ---- Data & Analytics ------------------------------------------------------------------
role('Data & Analytics', 'Data Analyst', 'data_analyst', ['hr_core', 'saas_ops', 'product_events', 'retail_sales', 'analytics_ops'], [], ['sql', 'chart', 'choice', 'writeup', 'python'],
  'Four levels, sixteen projects, five datasets. The track this whole simulation was built on.',
  { levels: LEVELS_4, status: 'live' });
role('Data & Analytics', 'Business Intelligence Analyst', 'bi_analyst', ['hr_core', 'saas_ops'], [], ['sql', 'chart', 'writeup'], 'Dashboard-shaped work on identical graders.');
role('Data & Analytics', 'Reporting / MIS Executive', 'mis_executive', ['hr_core', 'saas_ops'], [], ['sql', 'chart'], 'Enormous Indian volume and trivially gradeable.');
role('Data & Analytics', 'Operations Analyst', 'operations_analyst', ['saas_ops', 'analytics_ops'], [], ['sql', 'choice', 'writeup'], 'Both datasets already built.');
role('Data & Analytics', 'People / HR Analyst', 'hr_analyst', ['hr_core'], [], ['sql', 'chart', 'choice'], 'The dataset was built for exactly this, though three projects already mine it.');
role('Data & Analytics', 'Financial Analyst (FP&A)', 'fpna_analyst', ['retail_sales'], ['finance_gl'], ['sheet', 'chart', 'writeup'], 'The tool is Excel, not SQL — blocked on the spreadsheet grader.');
role('Data & Analytics', 'Marketing Analyst', 'marketing_analyst', [], ['marketing_funnel'], ['sql', 'chart', 'choice'], 'One new dataset, tools unchanged.');
role('Data & Analytics', 'Product Analyst', 'product_analyst', ['product_events'], [], ['sql', 'chart', 'choice'], 'Funnel and retention questions. The dataset exists and has the most headroom left.');
role('Data & Analytics', 'Growth Analyst', 'growth_analyst', ['product_events'], ['marketing_funnel'], ['sql', 'chart', 'choice'], 'Shares the marketing dataset once it exists.');
role('Data & Analytics', 'Data Quality / Steward', 'data_quality_steward', ['hr_core', 'saas_ops'], [], ['sql', 'choice'], 'Rule checks grade cleanly.');
role('Data & Analytics', 'Data Engineer', 'data_engineer', [], ['pipeline_sim'], ['sql'], 'The job is pipelines, not queries — we would be testing the wrong thing.');
role('Data & Analytics', 'Data Scientist', 'data_scientist', [], ['model_eval'], ['python'], 'Model quality cannot be graded fairly by comparing one result.');

// ---- Technology ------------------------------------------------------------------------
role('Technology', 'IT Support / Service Desk', 'it_support', ['saas_ops'], [], ['choice', 'writeup'], 'Ticket triage on the dataset we already have.');
role('Technology', 'Cybersecurity / SOC Analyst', 'soc_analyst', [], ['security_logs'], ['choice', 'sql'], 'Alert triage is pure judgement and scores cleanly. Strong market.');
role('Technology', 'QA Analyst / Test Engineer', 'qa_engineer', [], ['defects'], ['choice', 'writeup'], 'Test case design grades exactly against coverage.');
role('Technology', 'Database Administrator', 'dba', ['hr_core', 'saas_ops'], [], ['sql', 'choice'], 'Query tuning on datasets that exist.');
role('Technology', 'Data Privacy / DPO Analyst', 'privacy_analyst', [], ['policies'], ['choice', 'writeup'], 'Rule application against a request.');
role('Technology', 'Technical Writer', 'technical_writer', [], [], ['writeup'], 'Rubric handles accuracy and structure.');
role('Technology', 'Salesforce / CRM Admin', 'crm_admin', [], ['platform'], [], 'Needs the actual platform to be meaningful.');
role('Technology', 'Software Engineer', 'software_engineer', [], ['code_harness'], [], 'Needs code execution and tests. Big build, crowded market.');
role('Technology', 'DevOps Engineer', 'devops_engineer', [], ['infra_sandbox'], [], 'Needs code execution and an infrastructure sandbox, neither of which exists yet.');
role('Technology', 'Cloud Engineer', 'cloud_engineer', [], ['infra_sandbox'], [], 'Needs a real cloud sandbox to be worth anything, and we do not have one.');

// ---- Business, Product & Project -------------------------------------------------------
role('Business, Product & Project', 'Business Analyst', 'business_analyst', ['hr_core', 'saas_ops'], [], ['choice', 'writeup', 'sql'], 'The cheapest second role — reuses both datasets.');
role('Business, Product & Project', 'Business Process Analyst', 'business_process_analyst', ['saas_ops'], [], ['choice', 'writeup'], 'Process questions over data we already have.');
role('Business, Product & Project', 'Business Operations Associate', 'business_ops_associate', ['hr_core', 'saas_ops'], [], ['sql', 'choice', 'writeup'], 'Generalist day, existing data.');
role('Business, Product & Project', 'Project Manager', 'project_manager', ['analytics_ops'], [], ['choice', 'writeup'], 'Plans, risks, status and change requests — no new tool at all.');
role('Business, Product & Project', 'Program Manager', 'program_manager', ['analytics_ops'], [], ['choice', 'writeup'], 'Same shape, wider scope.');
role('Business, Product & Project', 'Product Manager', 'product_manager', ['product_events'], [], ['choice', 'writeup'], 'Prioritisation grades well; specs are prose.');
role('Business, Product & Project', 'Product Owner', 'product_owner', ['product_events'], [], ['choice', 'writeup'], 'Backlog and acceptance criteria.');
role('Business, Product & Project', 'Scrum Master / Agile Coach', 'scrum_master', ['analytics_ops'], [], ['choice', 'writeup'], 'Ceremony and impediment judgement.');
role('Business, Product & Project', 'Business Systems Analyst', 'business_systems_analyst', ['saas_ops'], [], ['choice', 'writeup'], 'Requirements against a real system.');
role('Business, Product & Project', 'Strategy Analyst', 'strategy_analyst', [], ['market'], ['choice', 'writeup', 'chart'], 'Needs a market-sizing dataset.');
role('Business, Product & Project', 'Management Consultant', 'management_consultant', [], ['market'], ['choice', 'writeup'], 'Framework application is gradeable; the pitch is not.');

// ---- Risk, Governance & Corporate ------------------------------------------------------
role('Risk, Governance & Corporate', 'Third Party / Vendor Risk Analyst', 'vendor_risk_analyst', [], ['vendors'], ['choice', 'writeup'], 'Questionnaire assessment against a standard — exactly gradeable.');
role('Risk, Governance & Corporate', 'Actuarial Analyst', 'actuarial_analyst', [], ['policies'], ['sheet', 'choice'], 'Reserving and pricing maths.');
role('Risk, Governance & Corporate', 'Operational Risk Analyst', 'operational_risk_analyst', [], ['incidents'], ['choice', 'writeup'], 'Loss events and control testing.');
role('Risk, Governance & Corporate', 'Business Continuity Analyst', 'business_continuity_analyst', [], ['incidents'], ['choice', 'writeup'], 'Impact analysis and scenario planning.');
role('Risk, Governance & Corporate', 'Internal Communications', 'internal_comms', [], [], ['writeup'], 'Audience and clarity, graded on a rubric.');
role('Risk, Governance & Corporate', 'Company Secretary / Governance', 'company_secretary', [], ['reg_rules'], [], 'Statutory and jurisdiction-bound. Maintenance forever.');

// ---- Finance & Accounting --------------------------------------------------------------
// Every role here is graded on `sheet` rather than `sql`, and that is deliberate: an
// accountant does not write SQL, they live in Excel. Tagging them for the SQL grader would
// mean teaching a trainee accountant the wrong skill and then telling them they were ready.
// The spreadsheet grader is the single highest-leverage build on this page — it gates
// fourteen roles here plus payroll, inventory, wealth operations and investment banking.
role('Finance & Accounting', 'Billing / Revenue Operations', 'billing_revops', ['saas_ops'], [], ['sql', 'choice'], 'One of the few finance-adjacent roles that genuinely queries.');
role('Finance & Accounting', 'Audit Associate', 'audit_associate', [], ['finance_gl'], ['choice', 'writeup', 'sheet'], 'Sampling and exception testing grade exactly.');
role('Finance & Accounting', 'Internal Auditor', 'internal_auditor', [], ['finance_gl'], ['choice', 'writeup'], 'Control testing is rule application.');
role('Finance & Accounting', 'Reconciliation Analyst', 'reconciliation_analyst', [], ['finance_gl'], ['sheet', 'choice'], 'Breaks are exact — right or wrong, nothing to argue.');
role('Finance & Accounting', 'Accounts Payable Executive', 'ap_executive', [], ['finance_gl'], ['sheet', 'choice'], 'Needs the spreadsheet grader.');
role('Finance & Accounting', 'Accounts Receivable Executive', 'ar_executive', [], ['finance_gl'], ['sheet', 'choice'], 'Ageing and collections priority.');
role('Finance & Accounting', 'Accountant / Bookkeeper', 'accountant', [], ['finance_gl'], ['sheet', 'choice'], 'Journal entries check deterministically.');
role('Finance & Accounting', 'Cost Accountant', 'cost_accountant', [], ['finance_gl'], ['sheet', 'choice'], 'Allocation method is a real judgement call.');
role('Finance & Accounting', 'Treasury Analyst', 'treasury_analyst', [], ['finance_gl'], ['sheet', 'choice'], 'Cash positioning and forecasting — spreadsheet work.');
role('Finance & Accounting', 'Financial Controller', 'financial_controller', [], ['finance_gl'], ['choice', 'writeup'], 'Close process and variance explanation.');
role('Finance & Accounting', 'Credit Analyst', 'credit_analyst', [], ['lending'], ['sheet', 'choice', 'writeup'], 'Strong Indian NBFC and fintech market.');
role('Finance & Accounting', 'Equity Research Associate', 'equity_research_associate', [], ['market'], ['sheet', 'writeup', 'chart'], 'Thesis is rubric-gradeable; the model is not, without the sheet.');
role('Finance & Accounting', 'Investment Banking Analyst', 'ib_analyst', [], ['market'], ['sheet', 'writeup'], 'Modelling needs the spreadsheet grader first.');
role('Finance & Accounting', 'Tax Associate', 'tax_associate', [], ['tax_rules'], ['choice'], 'Jurisdiction rules change yearly — high maintenance forever.');

// ---- BFSI Operations -------------------------------------------------------------------
role('BFSI Operations', 'KYC / AML Analyst', 'kyc_aml_analyst', [], ['kyc_cases'], ['choice', 'writeup'], 'Rule-based decisions grade almost perfectly. Huge market, no good simulator exists.');
role('BFSI Operations', 'Fraud Analyst', 'fraud_analyst', [], ['transactions'], ['sql', 'choice'], 'Alert triage is choice-shaped and scores cleanly.');
role('BFSI Operations', 'Insurance Claims Analyst', 'insurance_claims_analyst', [], ['claims'], ['choice', 'writeup'], 'Policy application against a claim.');
role('BFSI Operations', 'Insurance Underwriter', 'insurance_underwriter', [], ['policies'], ['choice', 'writeup'], 'Risk acceptance with stated appetite.');
role('BFSI Operations', 'Loan Processing Officer', 'loan_processing_officer', [], ['lending'], ['choice'], 'Document and eligibility checking.');
role('BFSI Operations', 'Trade Finance Analyst', 'trade_finance_analyst', [], ['trade_docs'], ['choice'], 'Document discrepancy checking is exact.');
role('BFSI Operations', 'Wealth / Mutual Fund Operations', 'wealth_operations', [], ['transactions'], ['choice', 'sheet'], 'Transaction exceptions and NAV checks.');

// ---- Capital Markets & Fund Services ---------------------------------------------------
role('Capital Markets & Fund Services', 'Fund Accounting / NAV Analyst', 'fund_accounting_analyst', [], ['fund_nav'], ['sheet', 'choice'], 'Enormous Pune, Bangalore and Chennai footprint. A NAV break is exact.');
role('Capital Markets & Fund Services', 'Corporate Actions Analyst', 'corporate_actions_analyst', [], ['corp_actions'], ['choice', 'sheet'], 'Pure rule application, same employers as fund accounting.');
role('Capital Markets & Fund Services', 'Settlements / Trade Reconciliation', 'settlements_analyst', [], ['transactions'], ['sheet', 'choice'], 'Trade breaks are exact.');
role('Capital Markets & Fund Services', 'Transfer Agency Analyst', 'transfer_agency_analyst', [], ['fund_nav'], ['choice'], 'Investor transactions and exceptions.');
role('Capital Markets & Fund Services', 'Collateral Management Analyst', 'collateral_analyst', [], ['transactions'], ['sheet', 'choice'], 'Margin calls and dispute resolution.');
role('Capital Markets & Fund Services', 'Client Onboarding Analyst', 'client_onboarding_analyst', [], ['kyc_cases'], ['choice', 'writeup'], 'Shares the KYC dataset — nearly free once that exists.');
role('Capital Markets & Fund Services', 'Regulatory Reporting Analyst', 'regulatory_reporting_analyst', [], ['finance_gl'], ['choice', 'sheet'], 'Rule-driven and deadline-driven.');
role('Capital Markets & Fund Services', 'Reinsurance Analyst', 'reinsurance_analyst', [], ['policies'], ['sheet', 'choice'], 'Treaty application against a claim.');

// ---- Operations & Supply Chain ---------------------------------------------------------
role('Operations & Supply Chain', 'Operations Manager', 'operations_manager', ['saas_ops', 'analytics_ops'], [], ['choice', 'writeup', 'sql'], 'Dataset built, and the level ladder already reaches here.');
role('Operations & Supply Chain', 'Service Delivery Manager', 'service_delivery_manager', ['saas_ops'], [], ['choice', 'writeup'], 'SLA and escalation judgement on existing data.');
role('Operations & Supply Chain', 'Supply Chain Analyst', 'supply_chain_analyst', [], ['supply_chain'], ['sql', 'chart'], 'One dataset unlocks the next five roles.');
role('Operations & Supply Chain', 'Inventory Analyst', 'inventory_analyst', ['retail_sales'], ['supply_chain'], ['sql', 'sheet'], 'Stock cover and reorder points.');
role('Operations & Supply Chain', 'Demand Planner', 'demand_planner', [], ['supply_chain'], ['sql', 'chart', 'writeup'], 'Forecast versus actual, and defending the gap.');
role('Operations & Supply Chain', 'Procurement / Sourcing Analyst', 'procurement_analyst', [], ['supply_chain'], ['choice', 'writeup'], 'Vendor comparison and award rationale.');
role('Operations & Supply Chain', 'Logistics Coordinator', 'logistics_coordinator', [], ['logistics'], ['choice', 'sql'], 'Route and exception handling.');
role('Operations & Supply Chain', 'Warehouse Operations Lead', 'warehouse_lead', [], ['logistics'], ['choice'], 'Throughput and labour allocation.');
role('Operations & Supply Chain', 'Quality Analyst (Process)', 'process_quality_analyst', [], ['quality'], ['choice', 'sql'], 'Defect analysis and corrective action.');
role('Operations & Supply Chain', 'Vendor Manager', 'vendor_manager', ['saas_ops'], [], ['choice', 'writeup'], 'Performance review and escalation.');

// ---- Manufacturing, Construction & Facilities ------------------------------------------
role('Manufacturing, Construction & Facilities', 'Quantity Surveyor', 'quantity_surveyor', [], ['construction'], ['sheet', 'choice'], 'Bills of quantity are exact. Large market, weak training.');
role('Manufacturing, Construction & Facilities', 'Production Planner', 'production_planner', [], ['manufacturing'], ['sheet', 'sql'], 'Schedule against real capacity.');
role('Manufacturing, Construction & Facilities', 'Maintenance Planner', 'maintenance_planner', [], ['manufacturing'], ['choice', 'sql'], 'Preventive versus reactive, with a cost either way.');
role('Manufacturing, Construction & Facilities', 'Industrial Engineer', 'industrial_engineer', [], ['manufacturing'], ['sql', 'choice'], 'Line balancing and cycle time.');
role('Manufacturing, Construction & Facilities', 'Six Sigma / CI Analyst', 'six_sigma_analyst', [], ['manufacturing'], ['sql', 'choice', 'writeup'], 'DMAIC is a method, and methods grade well.');
role('Manufacturing, Construction & Facilities', 'Estimation Engineer', 'estimation_engineer', [], ['construction'], ['sheet', 'choice'], 'Take-off and rate build-up.');
role('Manufacturing, Construction & Facilities', 'Facilities Manager', 'facilities_manager', [], ['facilities'], ['choice', 'writeup'], 'Service requests and vendor performance.');
role('Manufacturing, Construction & Facilities', 'Lease Administrator', 'lease_administrator', [], ['leases'], ['choice', 'sheet'], 'Clause tracking and rent review.');

// ---- Retail, E-commerce & Hospitality --------------------------------------------------
role('Retail, E-commerce & Hospitality', 'E-commerce Catalogue Analyst', 'catalogue_analyst', [], ['catalogue'], ['choice'], 'Enormous Indian volume and the rules are exact.');
role('Retail, E-commerce & Hospitality', 'Category Manager', 'category_manager', ['retail_sales'], [], ['sql', 'chart', 'choice'], 'Assortment and margin decisions. The dataset is already built.');
role('Retail, E-commerce & Hospitality', 'Merchandise Planner', 'merchandise_planner', ['retail_sales'], [], ['sheet', 'sql'], 'Buy plans and open-to-buy.');
role('Retail, E-commerce & Hospitality', 'Pricing Analyst', 'pricing_analyst', ['retail_sales'], [], ['sheet', 'choice'], 'Elasticity and competitor response.');
role('Retail, E-commerce & Hospitality', 'Revenue Manager (Hotels)', 'revenue_manager_hotels', [], ['bookings'], ['sheet', 'choice'], 'Rate and inventory decisions against demand.');
role('Retail, E-commerce & Hospitality', 'Store Operations Analyst', 'store_ops_analyst', ['retail_sales'], [], ['sql', 'choice'], 'Shrinkage, staffing and footfall. The dataset is already built.');
role('Retail, E-commerce & Hospitality', 'Travel Operations Executive', 'travel_ops_executive', [], ['bookings'], ['choice'], 'Fares, changes and exception handling.');
role('Retail, E-commerce & Hospitality', 'Customer Insights Analyst', 'customer_insights_analyst', [], ['survey'], ['chart', 'writeup'], 'Reading research honestly is the whole skill.');

// ---- HR & People -----------------------------------------------------------------------
role('HR & People', 'Recruiter / Talent Acquisition', 'recruiter', ['hr_core'], ['cv_engine'], ['choice', 'writeup'], 'Reuses the CV parsing TenzorGrid already has.');
role('HR & People', 'HR Generalist / HRBP', 'hr_generalist', ['hr_core'], [], ['choice', 'writeup'], 'Casework and policy application on existing data.');
role('HR & People', 'Compensation & Benefits Analyst', 'comp_benefits_analyst', ['hr_core'], [], ['sql', 'chart', 'writeup'], 'The dataset was built for exactly this.');
role('HR & People', 'HR Operations Executive', 'hr_operations_executive', ['hr_core'], [], ['choice'], 'Process execution and exception handling.');
role('HR & People', 'Employee Relations Specialist', 'employee_relations', ['hr_core'], [], ['choice', 'writeup'], 'Casework with a documented outcome.');
role('HR & People', 'L&D Coordinator', 'l_and_d_coordinator', ['hr_core'], [], ['choice', 'writeup'], 'Needs analysis and programme design.');
role('HR & People', 'Payroll Executive', 'payroll_executive', ['hr_core'], [], ['sheet', 'choice'], 'Needs the spreadsheet grader.');

// ---- Marketing & Growth ----------------------------------------------------------------
role('Marketing & Growth', 'Digital Marketing Executive', 'digital_marketing_executive', [], ['marketing_funnel'], ['sql', 'chart', 'choice'], 'Shares the analyst dataset.');
role('Marketing & Growth', 'Performance / Paid Media Analyst', 'paid_media_analyst', [], ['marketing_funnel'], ['sql', 'chart'], 'Budget reallocation grades well against outcomes.');
role('Marketing & Growth', 'SEO Analyst', 'seo_analyst', [], ['seo'], ['sql', 'choice'], 'Technical audit is checklist-shaped.');
role('Marketing & Growth', 'Email / CRM Marketing', 'crm_marketing', [], ['marketing_funnel'], ['choice', 'writeup'], 'Segmentation and sequence design.');
role('Marketing & Growth', 'Market Research Analyst', 'market_research_analyst', [], ['survey'], ['chart', 'writeup'], 'Reading a survey honestly is a real skill.');
role('Marketing & Growth', 'Content Marketing Executive', 'content_marketing_executive', [], [], ['writeup'], 'Rubric-gradeable, but taste creeps in at the edges.');
role('Marketing & Growth', 'Social Media Manager', 'social_media_manager', [], [], [], 'Judged on taste. Any score we gave would be arbitrary.');
role('Marketing & Growth', 'Brand Manager', 'brand_manager', [], [], [], 'Judged on taste like social media, with more riding on the call.');

// ---- Sales & Customer ------------------------------------------------------------------
role('Sales & Customer', 'Customer Success Manager', 'customer_success_manager', ['saas_ops'], [], ['choice', 'writeup'], 'Account health straight from the built dataset.');
role('Sales & Customer', 'Customer Support Lead', 'customer_support_lead', ['saas_ops'], [], ['choice', 'writeup'], 'Queue triage and escalation, existing data.');
role('Sales & Customer', 'Sales Operations Analyst', 'sales_ops_analyst', [], ['crm'], ['sql', 'chart'], 'Pipeline hygiene and forecast accuracy.');
role('Sales & Customer', 'Revenue Operations Analyst', 'revenue_ops_analyst', ['saas_ops'], ['crm'], ['sql', 'choice'], 'Sits across both datasets.');
role('Sales & Customer', 'Account Manager', 'account_manager', [], ['crm'], ['choice', 'writeup'], 'Renewal risk and expansion cases.');
role('Sales & Customer', 'Pre-Sales / Solution Consultant', 'presales_consultant', [], [], [], 'Needs a live demo to mean anything.');
role('Sales & Customer', 'Inside Sales Executive', 'inside_sales_executive', [], [], [], 'Needs real conversation, not a form.');
role('Sales & Customer', 'Field Sales', 'field_sales', [], [], [], 'Not simulable at a desk.');

// ---- Healthcare, Life Sciences & Legal -------------------------------------------------
role('Healthcare, Life Sciences & Legal', 'Medical Coder', 'medical_coder', [], ['coding_cases'], ['choice'], 'Codes are exact. Enormous Indian BPO market, weak existing training.');
role('Healthcare, Life Sciences & Legal', 'Pharmacovigilance Associate', 'pharmacovigilance_associate', [], ['adverse_events'], ['choice', 'writeup'], 'Case triage is rule-based. Big Indian employer base.');
role('Healthcare, Life Sciences & Legal', 'Healthcare Claims Analyst', 'healthcare_claims_analyst', [], ['claims'], ['choice', 'sql'], 'Adjudication against policy.');
role('Healthcare, Life Sciences & Legal', 'Clinical Data Analyst', 'clinical_data_analyst', [], ['trials'], ['sql', 'chart'], 'Query resolution and listings review.');
role('Healthcare, Life Sciences & Legal', 'Compliance Analyst', 'compliance_analyst', [], ['policies'], ['choice', 'writeup'], 'Rule application grades cleanly.');
role('Healthcare, Life Sciences & Legal', 'Contract Analyst', 'contract_analyst', [], ['contracts'], ['choice', 'writeup'], 'Clause review against a playbook.');
role('Healthcare, Life Sciences & Legal', 'Regulatory Affairs Associate', 'regulatory_affairs_associate', [], ['reg_rules'], [], 'Jurisdiction rules, high maintenance.');
role('Healthcare, Life Sciences & Legal', 'Medical Scribe', 'medical_scribe', [], [], [], 'Needs live audio.');
role('Healthcare, Life Sciences & Legal', 'Paralegal', 'paralegal', [], ['case_law'], [], 'Jurisdiction-heavy and hard to keep current.');

// ---- Trust, Safety & Content Operations ------------------------------------------------
role('Trust, Safety & Content Operations', 'Trust & Safety Analyst', 'trust_safety_analyst', [], ['content_cases'], ['choice', 'writeup'], 'Policy application on a queue. Huge Indian employment through the big outsourcers.');
role('Trust, Safety & Content Operations', 'Content Moderation QA', 'content_moderation_qa', [], ['content_cases'], ['choice'], 'Auditing other moderators against the same policy.');
role('Trust, Safety & Content Operations', 'Search Quality Rater', 'search_quality_rater', [], ['search_cases'], ['choice'], 'Guideline application — exactly what the real job is.');
role('Trust, Safety & Content Operations', 'Data Annotation QA', 'annotation_qa', [], ['annotation'], ['choice'], 'AI training data quality. Growing fast and barely trained for.');
role('Trust, Safety & Content Operations', 'Policy Enforcement Specialist', 'policy_enforcement_specialist', [], ['content_cases'], ['choice', 'writeup'], 'Appeals and escalations.');
role('Trust, Safety & Content Operations', 'Fact-checker', 'fact_checker', [], ['claims_text'], ['choice', 'writeup'], 'Source evaluation and verdict.');

// ---- Legal Process & eDiscovery --------------------------------------------------------
role('Legal Process & eDiscovery', 'eDiscovery / Document Review', 'ediscovery_reviewer', [], ['ediscovery'], ['choice'], 'Document review IS a case queue. Large Indian LPO market.');
role('Legal Process & eDiscovery', 'Contract Abstraction Analyst', 'contract_abstraction_analyst', [], ['contracts'], ['choice'], 'Extracting terms against a template — checkable.');
role('Legal Process & eDiscovery', 'IP / Patent Analyst', 'patent_analyst', [], ['patents'], ['choice', 'writeup'], 'Prior art search and classification.');
role('Legal Process & eDiscovery', 'Legal Research Associate', 'legal_research_associate', [], ['case_law'], ['writeup'], 'Jurisdiction-bound, but the method is gradeable.');

// ---- Sustainability, ESG & Safety ------------------------------------------------------
role('Sustainability, ESG & Safety', 'ESG / Sustainability Analyst', 'esg_analyst', [], ['esg'], ['sheet', 'choice', 'writeup'], 'Fast-growing, and the emissions maths is exact.');
role('Sustainability, ESG & Safety', 'Carbon Accounting Analyst', 'carbon_accounting_analyst', [], ['esg'], ['sheet', 'choice'], 'Scope 1, 2 and 3 calculation.');
role('Sustainability, ESG & Safety', 'Sustainability Reporting Analyst', 'sustainability_reporting_analyst', [], ['esg'], ['writeup', 'choice'], 'GRI and BRSR framework application.');
role('Sustainability, ESG & Safety', 'EHS Officer', 'ehs_officer', [], ['incidents'], ['choice', 'writeup'], 'Incident investigation and corrective action.');
role('Sustainability, ESG & Safety', 'Climate Risk Analyst', 'climate_risk_analyst', [], ['esg'], ['choice', 'writeup'], 'Scenario reasoning under uncertainty.');

// ---- Education & Development Sector ----------------------------------------------------
role('Education & Development Sector', 'M&E Officer', 'me_officer', [], ['programme_data'], ['sql', 'chart', 'writeup'], 'Development-sector standard role, and almost nobody trains for it.');
role('Education & Development Sector', 'Instructional Designer', 'instructional_designer', [], [], ['writeup', 'choice'], 'Learning objectives and assessment alignment grade against a rubric.');
role('Education & Development Sector', 'Curriculum Developer', 'curriculum_developer', [], [], ['writeup', 'choice'], 'Sequencing and coverage.');
role('Education & Development Sector', 'Grants Manager', 'grants_manager', [], ['programme_data'], ['sheet', 'writeup'], 'Budget tracking and donor compliance.');
role('Education & Development Sector', 'Programme Officer', 'programme_officer', [], ['programme_data'], ['choice', 'writeup'], 'Delivery against a logframe.');
role('Education & Development Sector', 'Academic Counsellor', 'academic_counsellor', [], ['enquiries'], ['choice', 'writeup'], 'Enquiry handling and honest fit assessment.');
role('Education & Development Sector', 'Corporate Trainer', 'corporate_trainer', [], [], [], 'Needs live delivery to a real room to mean anything.');

// ---- Media & Language ------------------------------------------------------------------
role('Media & Language', 'Copy Editor / Sub-editor', 'copy_editor', [], ['copy_cases'], ['choice', 'writeup'], 'Graded against a style guide, which makes it exact.');
role('Media & Language', 'Proofreader', 'proofreader', [], ['copy_cases'], ['choice'], 'Error detection is binary — the cleanest grading there is.');
role('Media & Language', 'Translator / Localisation QA', 'localisation_qa', [], ['localisation'], ['choice'], 'Terminology and consistency checks.');
role('Media & Language', 'Medical Writer', 'medical_writer', [], ['trials'], ['writeup'], 'Rubric handles accuracy and structure.');
role('Media & Language', 'Technical Content Reviewer', 'technical_content_reviewer', [], [], ['choice', 'writeup'], 'Accuracy against a source document.');

// ----------------------------------------------------------------------------------------

const BY_KEY = {};
for (const r of ROLES) {
  if (BY_KEY[r.key]) throw new Error(`Duplicate role key: ${r.key}`);
  BY_KEY[r.key] = r;
}

const SUBCATEGORY_OF = {};
for (const c of CATEGORIES) for (const s of c.subcategories) SUBCATEGORY_OF[s] = c.key;
for (const r of ROLES) {
  if (!SUBCATEGORY_OF[r.subcategory]) throw new Error(`Role ${r.key} is in an unknown function: ${r.subcategory}`);
  r.category = SUBCATEGORY_OF[r.subcategory];
}

// How far off a role is, derived rather than stored. 'ready' means it could be authored
// today against the engine as it stands; 'dataset' means a seeded dataset has to be built
// first; 'grader' means a grader we do not have (in practice, the spreadsheet) is in the
// way; 'unsuited' means it cannot be graded honestly at all and should not be promised.
function buildTier(r) {
  if (!r.graders.length) return 'unsuited';
  const missingGrader = r.graders.some((g) => !GRADERS_LIVE.includes(g));
  const missingData = r.needs.length > 0;
  if (missingGrader && missingData) return 'grader';
  if (missingGrader) return 'grader';
  if (missingData) return 'dataset';
  return 'ready';
}
for (const r of ROLES) r.buildTier = buildTier(r);

// Job titles per rung. Authored where a track exists, derived otherwise — a role nobody
// can enrol in yet does not need hand-written titles, but it does need to read correctly
// in the picker.
const AUTHORED_TITLES = {
  data_analyst: {
    junior: 'Junior Data Analyst',
    senior: 'Senior Data Analyst',
    lead: 'Data Analytics Team Lead',
    manager: 'Data Analytics Manager',
  },
};

const LEVEL_WORD = { junior: 'Junior', senior: 'Senior', lead: 'Lead', manager: 'Manager' };

function levelTitle(roleKey, levelKey) {
  const authored = AUTHORED_TITLES[roleKey];
  if (authored && authored[levelKey]) return authored[levelKey];
  const r = BY_KEY[roleKey];
  const label = r ? r.label : 'Analyst';
  if (levelKey === 'manager') return `${label} Manager`;
  return `${LEVEL_WORD[levelKey] || 'Junior'} ${label}`;
}

function getRole(roleKey) {
  return BY_KEY[roleKey] || null;
}

function levelsFor(roleKey) {
  const r = BY_KEY[roleKey];
  return (r ? r.levels : LEVELS_3).slice();
}

// The promotion ladder for a role: one rung per step up its own level list, so a
// three-rung role tops out at Lead and never renders a fourth bar nobody can reach.
function ladderFor(roleKey) {
  const levels = levelsFor(roleKey);
  const rungs = [];
  for (let i = 0; i < levels.length - 1; i += 1) {
    rungs.push({
      from: levels[i],
      to: levels[i + 1],
      title: levelTitle(roleKey, levels[i + 1]),
      minAverage: LEVEL_BARS[i] || LEVEL_BARS[LEVEL_BARS.length - 1],
    });
  }
  return rungs;
}

function isLive(roleKey) {
  const r = BY_KEY[roleKey];
  return Boolean(r && r.status === 'live');
}

function liveRoles() {
  return ROLES.filter((r) => r.status === 'live');
}

// The picker's whole payload: categories, the functions inside them, and every role with
// the two things the screen needs — whether it can be started, and what its rungs are.
function catalogueTree() {
  return CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    blurb: c.blurb,
    roleCount: ROLES.filter((r) => r.category === c.key).length,
    liveCount: ROLES.filter((r) => r.category === c.key && r.status === 'live').length,
    subcategories: c.subcategories.map((s) => ({
      label: s,
      roles: ROLES.filter((r) => r.subcategory === s).map((r) => ({
        key: r.key,
        label: r.label,
        note: r.note,
        status: r.status,
        levels: r.levels.map((l) => ({ key: l, label: levelTitle(r.key, l) })),
      })),
    })),
  }));
}

module.exports = {
  CATEGORIES, ROLES, DATASETS_BUILT, GRADERS_LIVE, LEVEL_BARS,
  getRole, levelsFor, levelTitle, ladderFor, isLive, liveRoles, catalogueTree,
};
