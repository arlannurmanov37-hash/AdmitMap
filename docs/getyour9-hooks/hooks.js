// GetYour9 creator guide: on-screen hooks for "surprised face, then site demo" videos.
// Each hook: [caption shown over the surprised-face shot, feature to show right after].
const T1 = "Task 1", T2 = "Task 2", EX = "AI examiner", SP = "Speaking", ANY = "Any feature";

window.SECTIONS = [
  {
    title: "Just found this",
    sub: "The discovery: she can't believe it exists.",
    hooks: [
      ["after 2 years of IELTS prep, i just found this?????", ANY],
      ["after 6 months of IELTS prep i just found this??", ANY],
      ["3 weeks before my IELTS and i just found this??", ANY],
      ["i just found out this website exists and i'm actually mad", ANY],
      ["wait why did nobody show me this before my IELTS??", ANY],
      ["i just found a website that checks my IELTS essays??", T2],
      ["i just found an AI that does IELTS speaking with you??", EX],
      ["just found a site that tells you your IELTS band for writing??", T2],
      ["i just found this and cancelled my IELTS tutor", ANY],
      ["found this at 2am the night before my IELTS", ANY],
      ["my friend got 7.5 and just told me she used THIS??", ANY],
      ["i just found the IELTS website everyone is gatekeeping", ANY],
      ["the IELTS website i found on day 300 of studying", ANY],
      ["i've been preparing for IELTS wrong this whole time??", ANY]
    ]
  },
  {
    title: "Time wasted",
    sub: "All the effort she put in before finding it.",
    hooks: [
      ["2 years of IELTS youtube videos and nobody mentioned this", ANY],
      ["40 practice tests later and i find THIS??", ANY],
      ["i wrote 100 IELTS essays with no one to check them...", T2],
      ["me realising i've been practising speaking alone in my room for months", EX],
      ["all those hours memorising vocabulary for nothing??", T2],
      ["i spent a whole year stuck at 6.5 for this??", ANY],
      ["i bought 4 IELTS books and none of them did this", T2],
      ["months of talking to my mirror for IELTS speaking. then this", EX],
      ["i rewrote the same task 2 essay 15 times before finding this", T2],
      ["the amount of time i wasted on IELTS before finding this", ANY],
      ["i was literally recording myself on my phone for speaking practice", SP],
      ["i studied IELTS for a year and nobody told me what my band actually was", ANY],
      ["all those graphs i described in task 1 with no feedback", T1]
    ]
  },
  {
    title: "Retakes and money",
    sub: "What she already paid before finding it.",
    hooks: [
      ["i paid for IELTS 3 times before finding this", ANY],
      ["i could have saved so much money on retakes", ANY],
      ["i paid a tutor every week for THIS??", T2],
      ["missed my band by 0.5 twice. then i found this", ANY],
      ["my IELTS retake money could have stayed in my pocket", ANY],
      ["i got 6.5 three times and i finally know why", T2],
      ["imagine paying for IELTS again because of your writing score", T2],
      ["i booked my retake and then found this...", ANY],
      ["my tutor charged me per essay and this just did it in seconds", T2],
      ["writing 6.0 again. then i saw what this showed me", T2],
      ["speaking 6.0 three times in a row and i finally see the problem", SP],
      ["the retake i didn't need to pay for", ANY]
    ]
  },
  {
    title: "POV",
    sub: "Put the viewer inside the moment.",
    hooks: [
      ["POV: you just found out your essay is a 6, not a 7", T2],
      ["POV: you find the IELTS website a week before your test", ANY],
      ["POV: an AI examiner just asked you a part 3 question", EX],
      ["POV: you finally see why your writing score won't move", T2],
      ["POV: you realise you've been answering the wrong question in task 2", T2],
      ["POV: you hear how many times you said \"um\" in one answer", SP],
      ["POV: you practise IELTS speaking at 1am and nobody judges you", EX],
      ["POV: your task 1 just got checked in seconds", T1],
      ["POV: you see your IELTS band before the real exam", ANY],
      ["POV: your speaking answer gets broken down criterion by criterion", SP],
      ["POV: you stop guessing your IELTS band", ANY],
      ["POV: the AI examiner is nicer than the real one", EX],
      ["POV: you find out what's actually holding your band back", ANY],
      ["POV: you're about to stop paying for IELTS retakes", ANY]
    ]
  },
  {
    title: "Nobody told me",
    sub: "Make it feel like a secret she just learned.",
    hooks: [
      ["why did no one tell me you can practise IELTS speaking with AI??", EX],
      ["nobody told me IELTS writing has 4 separate criteria", T2],
      ["nobody told me my task 1 overview was the problem", T1],
      ["why is no one talking about this IELTS website", ANY],
      ["no one told me my fluency was the reason i got 6", SP],
      ["nobody told me you could check your essay like this", T2],
      ["my IELTS teacher never showed me this", ANY],
      ["they don't tell you this before your IELTS exam", ANY],
      ["no one warned me about my filler words in speaking", SP],
      ["nobody told me what a band 7 essay actually looks like", T2],
      ["i really thought i had to pay a tutor to get IELTS feedback", ANY],
      ["the IELTS website no one in my class knows about", ANY]
    ]
  },
  {
    title: "Disbelief",
    sub: "Pure shock. Short and loud.",
    hooks: [
      ["wait... this actually exists for IELTS??", ANY],
      ["no way this checked my whole essay in seconds", T2],
      ["is this actually how examiners score you??", T2],
      ["this AI just did a full IELTS speaking test with me??", EX],
      ["it found the exact sentence that was dragging my essay down", T2],
      ["it literally counted my pauses", SP],
      ["how does this know my band??", ANY],
      ["i can't believe this exists for IELTS", ANY],
      ["it told me my band AND why. i'm shook", ANY],
      ["this is too good for IELTS students", ANY],
      ["i'm actually speechless rn", ANY],
      ["how is this not illegal for IELTS", ANY]
    ]
  },
  {
    title: "Writing Task 2",
    sub: "Show an essay going in and the band breakdown coming out.",
    hooks: [
      ["i put my task 2 essay in here and...", T2],
      ["i thought my essay was a 7. this says otherwise", T2],
      ["checking my IELTS essay before my tutor sees it", T2],
      ["task 2 essays were my nightmare until i found this", T2],
      ["this showed me exactly why my essay was stuck at 6", T2],
      ["i was so sure my essay was perfect...", T2],
      ["same essay, before and after this told me what to fix", T2],
      ["my task response score was the problem the whole time??", T2],
      ["40 minutes writing, 10 seconds to find out my band", T2],
      ["i wrote an essay tonight and immediately regretted it", T2],
      ["the moment you find out \"moreover\" isn't saving your essay", T2],
      ["checking if my essay is a 6 or a 7...", T2]
    ]
  },
  {
    title: "Writing Task 1",
    sub: "Show a graph, letter or process report getting checked.",
    hooks: [
      ["i put my task 1 report in here and...", T1],
      ["i've been writing task 1 wrong this whole time??", T1],
      ["my bar chart description was NOT it", T1],
      ["task 1 maps used to make me cry. then this", T1],
      ["i thought task 1 was the easy part...", T1],
      ["checking my general training letter before the exam", T1],
      ["my task 1 was a 6 and i had no idea why", T1],
      ["150 words and i still lost marks?? this showed me where", T1],
      ["process diagrams were ruining my writing score", T1],
      ["the task 1 overview i kept forgetting...", T1]
    ]
  },
  {
    title: "AI examiner",
    sub: "Show a live speaking session with the AI examiner.",
    hooks: [
      ["i just did IELTS speaking with an AI examiner??", EX],
      ["practising IELTS speaking at 3am because this exists now", EX],
      ["i don't need a speaking partner anymore", EX],
      ["an AI examiner just interviewed me for IELTS", EX],
      ["this AI asked me a part 2 cue card and i froze", EX],
      ["IELTS speaking practice but the examiner is AI", EX],
      ["i was too shy to practise speaking with people. then this", EX],
      ["the AI examiner talks back like a real one??", EX],
      ["me doing a full speaking test in my pyjamas", EX],
      ["i practised speaking with this every night for a week", EX],
      ["my mind always goes blank in speaking. so i tried this", EX],
      ["speaking part 3 with AI and it actually pushed back??", EX],
      ["no partner, no tutor, still did a full speaking test", EX],
      ["talking to an IELTS examiner that doesn't judge you", EX]
    ]
  },
  {
    title: "Band reveal",
    sub: "Build up to the score screen. Show it last.",
    hooks: [
      ["finding out my real IELTS band...", ANY],
      ["i was NOT ready for this band score", ANY],
      ["checking my speaking band before the real test", SP],
      ["this is what band 8 speaking looks like apparently", SP],
      ["my writing band is... wait", T2],
      ["i got my band breakdown and now i know what to fix", ANY],
      ["the criterion that was dragging my band down", ANY],
      ["i've been stuck at 6.5 and this told me why", ANY],
      ["checking if i'm ready to book my IELTS", ANY],
      ["my fluency score vs my vocabulary score...", SP],
      ["band 6 to band 7 is THIS close apparently", ANY],
      ["reading my speaking feedback like", SP]
    ]
  },
  {
    title: "Deadlines and goals",
    sub: "Tie the shock to the thing riding on her score.",
    hooks: [
      ["my visa needs a 6.5 and i just found this", ANY],
      ["my uni offer depends on one IELTS score. then this", ANY],
      ["2 weeks until my IELTS and i just found this", ANY],
      ["my test is on saturday and i just found this??", ANY],
      ["applying to canada and i almost didn't find this", ANY],
      ["i need a 7 in every section and i just found this", ANY],
      ["my scholarship needs a 7.0 writing. so i tried this", T2],
      ["UK uni deadline is coming and my writing is still a 6", T2],
      ["nursing abroad needs a 7 in speaking. this is how i'm practising", EX],
      ["one score between me and moving abroad", ANY],
      ["my whole plan depends on IELTS and i just found this", ANY],
      ["my IELTS is in 30 days. this is what i'm using", ANY]
    ]
  },
  {
    title: "Me vs",
    sub: "Contrast what she did before with what she does now.",
    hooks: [
      ["me before vs after finding this IELTS website", ANY],
      ["my IELTS tutor vs this AI. i'm sorry...", T2],
      ["me practising speaking with my mirror vs now", EX],
      ["what i thought my essay was vs what it actually was", T2],
      ["20 practice tests vs 10 seconds on this", ANY],
      ["my essay before vs after the feedback", T2],
      ["my speaking answer before vs after fixing my pauses", SP],
      ["people who know about this vs people who don't", ANY],
      ["my first IELTS prep vs my retake prep", ANY],
      ["how i studied for IELTS vs how i should have", ANY]
    ]
  }
];
