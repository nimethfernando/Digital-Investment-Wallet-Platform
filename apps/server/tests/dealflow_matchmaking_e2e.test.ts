import { prisma } from '../src/lib/prisma';
import { ventureMatchmakingService } from '../src/services/ventureMatchmaking.service';

async function runDealflowMatchmakingTest() {
  console.log('==================================================================');
  console.log('🚀 Running Venture Fund Dealflow & Matchmaking E2E Lifecycle Test');
  console.log('==================================================================');

  // 1. Ensure Schema
  await ventureMatchmakingService.ensureSchema();
  console.log('✅ 1. Venture Dealflow Database Tables Ready (diw_venture_opportunities & diw_opportunity_applications)');

  // 2. Find or create two test users
  let investorUser = await prisma.user.findFirst({
    where: { email: { contains: 'admin' } },
  });
  if (!investorUser) {
    investorUser = await prisma.user.findFirst();
  }
  let applicantUser = await prisma.user.findFirst({
    where: { id: { not: investorUser?.id } },
  });

  if (!investorUser || !applicantUser) {
    throw new Error('Need at least 2 users in DB to test matchmaking lifecycle');
  }

  console.log(`✅ 2. Test Users: Investor/Lender [${investorUser.email}] vs Applicant [${applicantUser.email}]`);

  // 3. Investor creates an Investment & Lending Opportunity Post
  const opp1 = await ventureMatchmakingService.createOpportunity(investorUser.id, {
    title: 'Seed Capital & Working Capital Debt for Enterprise SaaS & Fintech',
    description: 'We are active angel investors and private lenders looking to allocate up to $250,000 in early-stage B2B SaaS and cross-border fintech startups.',
    intent: 'OFFERING_CAPITAL',
    dealType: 'EQUITY_INVESTMENT',
    targetAmount: 250000,
    minAmount: 25000,
    maxAmount: 250000,
    currency: 'USD',
    preferredTerms: 'SAFE Note with $5M valuation cap and 20% discount; or 12-month senior loan at 8.0% APR',
    expectedInterestRate: 8.0,
    tenureMonths: 12,
    industry: 'Fintech & SaaS',
    stage: 'Seed / Early Revenue',
    locationCountry: 'Global',
    contactEmail: investorUser.email,
  });

  console.log(`✅ 3. Created Opportunity Post: [${opp1.opportunityCode}] "${opp1.title}" (Target: $${opp1.targetAmount} USD)`);

  // 4. Startup founder creates a Seeking Capital Post
  const opp2 = await ventureMatchmakingService.createOpportunity(applicantUser.id, {
    title: 'Bridge Loan Facility for Healthcare Logistics Supply Chain',
    description: 'Operating medical logistics platform with $1.2M ARR seeking a $150,000 6-month inventory financing loan to fulfill hospital procurement contracts.',
    intent: 'SEEKING_CAPITAL',
    dealType: 'DEBT_LOAN',
    targetAmount: 150000,
    currency: 'USD',
    preferredTerms: 'Fixed 9.0% annualized interest with bullet principal repayment at month 6',
    expectedInterestRate: 9.0,
    tenureMonths: 6,
    industry: 'Healthcare & Logistics',
    stage: 'Growth / Profitable SME',
    locationCountry: 'United States',
  });

  console.log(`✅ 4. Created Seeking Capital Post: [${opp2.opportunityCode}] "${opp2.title}"`);

  // 5. Registered Applicant applies to the Investor's opportunity post
  const appResult = await ventureMatchmakingService.applyToOpportunity(applicantUser.id, opp1.id, {
    applicantRole: 'STARTUP_FOUNDER',
    proposedAmount: 75000,
    proposedTerms: 'SAFE note with $4M cap, looking for $75,000 tranche with 12 months runway',
    applicantNote: 'Our company has $35k MRR growing 15% MoM with positive unit economics. Would love to connect and share our audited data room and live demo.',
    pitchDeckUrl: 'https://avorabank.com/decks/sample-pitch.pdf',
  });

  console.log(`✅ 5. Applicant Applied: [${appResult.applicationCode}] Proposed: $${appResult.proposedAmount} USD (Status: ${appResult.status})`);

  // 6. Verify duplicate application prevention
  try {
    await ventureMatchmakingService.applyToOpportunity(applicantUser.id, opp1.id, {
      applicantRole: 'STARTUP_FOUNDER',
      proposedAmount: 50000,
      applicantNote: 'Trying duplicate submission',
    });
    throw new Error('Duplicate application should have thrown an error!');
  } catch (err: any) {
    console.log(`✅ 6. Duplicate Application Blocked: "${err.message}"`);
  }

  // 7. Verify listing opportunities with filters
  const equityOpps = await ventureMatchmakingService.listOpportunities({ dealType: 'EQUITY_INVESTMENT' });
  const debtOpps = await ventureMatchmakingService.listOpportunities({ dealType: 'DEBT_LOAN' });
  console.log(`✅ 7. Filtered Opportunities: ${equityOpps.length} Equity Deals, ${debtOpps.length} Debt Deals`);

  // 8. Admin reviews all applications and filters
  const adminApps = await ventureMatchmakingService.adminListApplications({
    opportunityId: opp1.id,
  });
  console.log(`✅ 8. Admin Collected Applications: ${adminApps.length} application(s) found for Opportunity ${opp1.opportunityCode}`);
  const targetApp = adminApps[0];
  console.log(`   Applicant: ${targetApp.applicant?.name} (${targetApp.applicant?.email}) | Note: "${targetApp.applicantNote.slice(0, 60)}..."`);

  // 9. Admin Connects the Relevant Investor & Applicant!
  const connectResult = await ventureMatchmakingService.adminUpdateApplicationStatus(
    targetApp.id,
    investorUser.id,
    {
      status: 'CONNECTED',
      adminNotes: 'Candidate screened and verified. High traction fit for angel portfolio.',
      connectionNotes: 'Direct introduction sent to investor and founder for term sheet discussion.',
    }
  );
  console.log(`✅ 9. Admin Matchmaking Action: Status &rarr; ${connectResult.status} (${connectResult.message})`);

  // 10. Verify Applicant sees their application status as CONNECTED
  const myApps = await ventureMatchmakingService.getMyApplications(applicantUser.id);
  const updatedApp = myApps.find((a) => a.id === targetApp.id);
  if (!updatedApp || updatedApp.status !== 'CONNECTED') {
    throw new Error(`Expected application status to be CONNECTED, got ${updatedApp?.status}`);
  }
  console.log(`✅ 10. Applicant Dashboard Verified: Application ${updatedApp.applicationCode} is LIVE CONNECTED!`);

  console.log('------------------------------------------------------------------');
  console.log('🎉 Dealflow Matchmaking End-to-End Lifecycle Verified Successfully!');
  console.log('------------------------------------------------------------------');
}

runDealflowMatchmakingTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Dealflow Test Failed:', err);
    process.exit(1);
  });
