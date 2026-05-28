+++
date = '2026-04-04T13:51:07+04:00'
draft = true
title = 'Claude Helps Predict My Blood Sugar'
math = true
toc = true
tags = ["diabetes", "biohacking", "ai"]
showTags = true
readTime = true
autonumber = true
+++

<!--more-->

## Slop Manufacturing With Intent To Distribute

Yes I see the irony in the "written by a human" badge when the title begins with "Claude".
But it is true---a lot of the text is still written by me, and Claude's outputs are 
`easily distinguishable`. Hunting for em-dashes in the text is superfluous; besides, I also
like to use them, so many of them would have been false positives anyway.

To give a short TL;DR: I am diabetic and I want to have an app that can make my life a little easier
by reliably predicting my blood sugar given factors like: the food that I just ate, the amount of
insulin that I need to bolus, exercise, etc. I also want the ability to make "what-if" decisions, e.g.
how much would eating a bowl of chicken soup this evening increase my blood sugar, and how much insulin would I
need to use so that I don't get nocturnal hypoglycemia, given the fact that I just bolused 2 units of fast-acting
insulin for a snack, and I am about to go running for 20 minutes? By the end of this article we get a model
that has SOTA performance and runs real-time on a Samsung A12, plus an app (free and open source!) that functions as a control interface. Nice.

## I Haz Diabeetus

Specifically Type 1. You can [Google](https://letmegooglethat.com/?q=Type+1+Diabetes) what it is. Basically, my life is on a manual transmission: I have to calculate
how much insulin I need to bolus, when to bolus, how much food to eat, what kind of food, how much basal insulin I need
to inject so that I don't wake up drenched in sweat and my heart racing in the middle of the night 2 days from now, etc etc.
I can't do the many things that a lot of non-diabetics have no trouble doing. I can't just come home from work, have a slice of pizza, and then go to sleep.

Here's what my blood sugar levels look like for the past 19 days:

![My blood sugars for the past 19 days](./img/BloodSugar19Days.png#center "My BG statistics (past 19 days)")

It's not too bad, but looking at the daily graphs, you can see the pain:

![My daily blood sugars for the past 19 days](./img/BloodSugarDaily19Days.png#center "Daily BG values (past 19 days)")

Besides giving me these nice looking plots, my CGM app doesn't have any other interesting features:

- It doesn't tell me how many carbs to eat to raise my blood sugar during hypoglycemia.
- It doesn't tell me how much insulin to bolus to get me out of hyperglycemia.
- It doesn't tell me how much I should exercise if I want to keep my levels in-range.
- It doesn't even predict what my blood sugar levels will look like in the next couple of hours.

I do have the ability to log carbs, insulin, exercise, etc. But they aren't utilized beyond for drawing some nice-looking
icons on the BG graph. Personally I never log any of my meals or insulin boluses---I don't see any value in it.

## Enshittification Of Diabetes Apps

I don't think it is fair to say that the diabetes apps have become enshittified---they have always been shit.
There are two classes of diabetes apps:

- Apps made by CGM manufacturers: Whenever you buy a CGM, you are ~~forced~~ instructed to install the official app to use it.
These also require setting up an account (because God forbid I get to use the hardware that I paid for without giving up
all my personal information). These
apps are feature-poor, and they only work with CGMs of the manufacturer. It is surprising how these companies
are still paying for subpar software when instead they could focus on the hardware and let the open-source community come up
with a much better product. Of course, this would require them to collaborate on an open API, and AFAIK there is no
Khronos-equivalent for CGM manufacturers---they could learn a thing or two from the GPU manufacturers, but why spend time learning
when ignorance is instantaneous?
- Apps made by third parties: Most of the time, these are just glorified notepads. All they do is let you import your BG data
from a CGM app, and put some bells and whistles on it like providing additional statistical information not available on the
feature-poor CGM app. Very rarely you will stumble on one that can actually predict your blood sugar levels, and even then, most features
are paywalled and the app itself is often worse in terms of respecting user's privacy than the manufacturer's app. In one case,
the [privacy policy](https://diabtrend.com/privacy/en) specifies that the app may share your personal information with so-called
"Data Processors", one of whom is Facebook. Ah yes, nothing makes me trust you with my sensitive personal health information than knowing that
you will share it with Mark Zuckerberg.

![Diabetes Apps in Play Store](./img/TerribleDiabetesApps.png#center "Most of these apps are simple note-takers. Many of them require accounts, and the most needed features like BG prediction are often paywalled. \"Beyond Type 1 Diabetes\" is a social network, but thankfully I am an introvert so that's one less app to share my personal information with. I don't like any of these apps except \"Level One: A Diabetes Game\"---I kid you not, this game has modelled blood sugar dynamics better than most of these so-called predictors. I have more than 5 YOE with this disease and I couldn't beat its levels the first time I played it. It also has no ads or in-app purchases. I salute the developers. Install it and play it yourself to get an idea of what T1DM patients go through in their daily lives.")

So we are clearly in need of something better. Here are my requirements for an actually good T1DM app:

- No account needed. The app must function end-to-end without the Internet.
- Reliable blood sugar level prediction with many tunable parameters. When I use [llama.cpp](https://github.com/ggml-org/llama.cpp) I can change the temperature, top p, context size, etc.---I
want something similar with the BG prediction model.
- All data stays on device. No telemetry.
- Huggingface-like (local) repository of models, so that I can quickly try different models and gauge their strengths/weaknesses.
- Continuous on-device fine-tuning based on patient history.
- Free and open source.

There is [xDrip](https://github.com/NightscoutFoundation/xDrip), but I found its BG predictions too simplistic and unreliable. It doesn't seem
to take my behavioral patterns into account. It also doesn't support the [CGM model](https://www.sibionicscgm.com/products/sibionics-gs1-continuous-glucose-monitoring-cgm-system) that I use (I suppose it is because they want to avoid the legal trouble that comes with reverse-engineering a commercial device, but there could be other reasons).
One area where xDrip will definitely be better than my app is the sheer number of features it has
(at the moment of writing this article, it has more than 9000 commits on Github).
I don't have access to every CGM device out there, so I will begin with the [model](https://www.sibionicscgm.com/products/sibionics-gs1-continuous-glucose-monitoring-cgm-system)
that I already own. There are also DIY systems like [AAPS](https://androidaps.readthedocs.io/en/latest/)---unfortunately I don't have a pump
to build a closed-loop system of my own, so my app will need to work given the two assumptions below:

- I have a CGM that shows me my BG values every 5 minutes.
- I want to see how my blood sugar levels are affected by factors like exercise.

## The Fermi Paradox of BG Models

There are quite a few papers out there
that try to predict blood sugar levels, so let's see how they do it.

### CGM-LSM

These papers tend to contain a lot of redundant text that makes them hard to read (for the love of God, you don't need to tell me what RMSE is, I can Google it just fine!).
Thankfully it is 2026---these days we can talk with the papers.

![Wow](./img/wow_much_useful.png#center "Thanks, I couldn't have figured it out myself.")

Apparently they trained a GPT-2 transformer on blood glucose data, using a proprietary dataset called the "Welldoc Dataset".
This won't help me because the way this model was trained precludes the patient from asking "what-if" questions like
"what will happen to my BG if I eat this snack that has 20g of fast-acting carbs?". In fact, they acknowledge this in their paper:

![You had one job](./img/bad_researcher_bad.png#center "Unfortunately those are precisely the inputs that the predictor needs to answer \"what-if\" questions.")

On their website, Welldocs says that they make AI-based health recommendations as
shown in the image below (this is from their [home page](https://www.welldoc.com/)). I suppose their datasets are sourced from their users? I am not sure.

![Very useful health info](./img/welldoc.png#center "I love this guy because that's exactly the face I would have made if I also received this **highly-personalized AI-based** advice. Image belongs to Welldoc.")

Here's [the link](https://aistudio.google.com/app/prompts?state=%7B%22ids%22:%5B%2216Vqh8gjI2J48jYB9cFK_W4y9OOaKxPmc%22%5D,%22action%22:%22open%22,%22userId%22:%22104194944460338666484%22,%22resourceKeys%22:%7B%7D%7D&usp=sharing) to the conversation with Gemini about this paper. Here's [the link](https://www.nature.com/articles/s44401-025-00039-y) to the paper itself
(they have a nice image of token embeddings for you to look at).

> Note: Yes I know I said I will talk with Claude, but I found Gemini to be better at summarizing research papers.

### BiT-MAML

This one is a little bit confusing. First of all, 30 to 60 minutes of prediction horizon (PH) is too short.
The model won't be of much use if I want to learn whether I will have a low blood sugar event during sleep
(this would require the model to predict at least 8 hours into the future). They also trained the model on
5 patients---isn't that number too low?

There are two models here working in tandem: one is an LSTM that is used to capture short-range dependencies,
and then there is a transformer used for long-range dependencies. I don't understand why they had
to use an LSTM---wouldn't a transformer-only architecture be sufficient? Or was the LSTM required because
there wasn't enough data for the transformer to converge on?
I can't see a fundamental reason for why the transformer wouldn't have learned the short-term
changes in BG data by itself (without the LSTM module).

There are stranger things going on here. One of the features in the training dataset is a binary flag called the "Hypoglycemic event indicator".
But the model already receives CGM outputs, and it predicts only BG values, so what is the use for this flag? What does the model gain
by knowing that a certain range of BG values correspond to hypoglycemia? My first instinct was that maybe the model will learn that the rate
of decrease in BG levels may be lower during hypoglycemia (the hypothesis being that the body starts to counteract by releasing cortisol), but if true, wouldn't this knowledge lie implicit
in the CGM outputs?

Another problem is that carb intake and insulin boluses are treated as single-point events, instead of curves. This isn't good because
not all carbs are the same. 20 grams of carbs in a slice of pizza is a different beast than 20 grams of carbs in a can of coke.
Combining carbs with fats and protein can also reduce its absorption rate.

There is also this section:

![Failed successfully](./img/failed_successfully.png#center "I don't get how the fact that people are different is a \"crucial scientific insight\"---I thought that was already the assumption.")

Then this section:

![Bro wants a different metric](./img/bro_please.png#center "Bro wants us to change our evaluation metrics because he couldn't achieve p < 0.05 💀 💀 💀. Jokes aside, I think the reason why the model is inconsistent in its predictions is because of how small the training dataset is.")

I am surprised at the fact that the researchers are surprised that the model isn't good at predicting the blood sugar values of an out-of-distribution individual. What did you
expect? You trained this thing on 5 patients!

![Patient Heterogeneity](./img/dr_house_diabetes.png#center "I'd argue that the observed variability is likely due to dataset deficiency. Also, you don't need a framework to identify a \"hard-to-predict\" individual---[you can see the powdered sugar on their clothes](https://www.youtube.com/watch?v=dM-TT8211RA).")

Anyways, here is [the link](https://www.nature.com/articles/s41598-025-13491-5) to the paper, and the [Gemini conversation](https://aistudio.google.com/app/prompts?state=%7B%22ids%22:%5B%22169CK8-6EyfD4g177BpZiV00UHQyqSGeW%22%5D,%22action%22:%22open%22,%22userId%22:%22104194944460338666484%22,%22resourceKeys%22:%7B%7D%7D&usp=sharing).

### BGFormer

This model looks similar to the previous one, except that they have swapped the LSTM module with their own thing called "Microscale Overlapping Concerns" (MOC).
The authors have introduced two additional modules which they have named "Feature Enhancement Module" (FEM) and "Dual Attention Enhancement Module" (DAM), respectively. FEM is basically
used to the teach the concept of temporality to the model. Here's the authors' description:

![FEM module in BGFormer](./img/bgformer_fem.png#center)
![FEM module in BGFormer](./img/bgformer_time2.png#center "My guess for why this module is needed is because the PH of this model is so short that they needed an additional way of saying to the model: \"Hey, by the way, it is noon!\".")

This model's PH is too short---it is 60 (or 90?)
minutes into the future. It was trained on 16 patients. This model wasn't fed with carb intake and insulin bolus data, so the predictions are mostly based on historical CGM outputs,
rendering it useless for the sort of tasks that I would want a model to do.

If I understand the paper correctly, the authors basically took the [Informer](https://arxiv.org/abs/2012.07436) (a transformer variant), discovered that an architecture designed
to capture long-term dependencies isn't as good in capturing short-term dependencies, so instead of abandoning it altogether, they duck-taped the Informer with
MOC, which, by the way, is sensitive to the chosen hyperparameters (namely, the window size). From their paper:

![BGFormer is sensitive](./img/bgformer_windows.png#center "Here the \"number of windows\" is a hyperparameter that (it seems to me) needs to be adjusted on a per-patient basis.")

![BGFormer is sensitive with respect to the number of windows](./img/bgformer_window.png#center "You can see how the number of windows affects both the RMSE and MAE based on the BG values of the three patients. Be careful when reading these graphs: notice how the height of the vertical axis changes between the patients! You can see the \"real\" graphs below.")

![BGFormer Real Graphs](./img/bgformer_actual_graph.png#center "I fixed the graphs so you can see how inconsistent the model's accuracy is based on the patient and the window size.")

![Monster Princess](./img/monster_princess.webp#center "BGFormer")

Here is [the link](https://www.sciencedirect.com/science/article/pii/S1532046424001333) to the paper and [the Gemini conversation](https://aistudio.google.com/app/prompts?state=%7B%22ids%22:%5B%221A2mOKqTH8yHNDS3qRZwENtyk8BV3ZqJY%22%5D,%22action%22:%22open%22,%22userId%22:%22104194944460338666484%22,%22resourceKeys%22:%7B%7D%7D&usp=sharing).

### GluFormer

They certainly aren't creative with the names, are they? There is a [blog post](https://blogs.nvidia.com/blog/ai-research-diabetes-gluformer/) about this paper on Nvidia's website.
I haven't seen many blog posts written on BG prediction.
The title is a little misleading though, it is not the case that the model will predict your blood sugar at 14:00 on a windy afternoon four years from now.
They also have published a [Github repo](https://github.com/Guylu/GluFormer), which is nice.

> Note: I should have included the Github repos of the previous studies, too. Here they are: [CGM-LSM](https://github.com/JHU-CDHAI/cgmlsm) ... and that's it.
I couldn't find any git repositories for the other papers; if you've found them, please send a [PR](https://github.com/0xdeadf1sh/0xdeadf1.sh).

The researchers used [The Human Phenotype (HPP)](https://humanphenotypeproject.org) dataset, do you think I can access it too?

![1984](./img/pheno_team.png#center "Literally 1984")

I guess not. Currently it is April, and I have to wait until sometime around July or August to get a response. I may not receive access if my research is deemed unworthy, and [I am not going to wait](https://www.diabetes.co.uk/blog/2016/07/the-wearenotwaiting-movement-is-helping-people-with-diabetes-improve-their-health-now-not-later/).
Also their [application form](https://www.pheno.ai/open-innovation) expects me to be a part of an educational institution, which I am not.

The model was trained on 10812 adults, but they were mostly healthy. The authors claim that their model generalized well to diabetics. Does this mean that HPP doesn't have the
CGM readings for diabetics at all, or did the authors deliberately decide not to utilize it? I fail to understand exactly why wouldn't you want to include the BG readings of diabetics in your training dataset.

The idea behind this paper is this: by teaching a model to predict short-term BG values of patients, the model will be able to predict "where" those patients
will be in terms of health outcomes multiple years into the future. So to me it seems that this isn't a model for patients, but for healthcare professionals. I did find this part amusing:

![The Black Pill](./img/the_black_pill.png#center "No it is not warranted. Swallow the black pill and accept the [bitter lesson](http://www.incompleteideas.net/IncIdeas/BitterLesson.html)")

One problem that I have with this model is that the carb intake is a single-point event---it is not a curve. So the model cannot distinguish between different types of carbs.
No insulin boluses were specified either. This isn't surprising, given that the training dataset consists mostly of healthy people.

This looks like a model designed more for the doctors than their patients. Because I find it more important to know whether my blood sugar will drop tonight than which cohort I will belong to in 5 years
(OK, I will admit: I **am** interested in knowing how sick I will be in the future, but if nocturnal hypoglycemia kills me tonight, then the model's predictions for the far-future are moot).

Even though the HPP dataset is proprietary, thanks to this paper we can at least gather some statistical info on it. For example:

![God's Chosen People](./img/hpp_chosen.png#center "The dataset contains 10812 of God's chosen people (FSLP and FSL IQ are CGM models)")

![Daily CGM Values](./img/gluformer_cgm.png#center "You can see the effect of multiple types of carbs on this person's BG. In the morning, first the simple sugars in the cookies caused a rapid spike in blood sugar, but once that is handled by endogenous insulin, the remaining complex carbs start to slowly break down into glucose and get released to the bloodstream, keeping the BG high for some duration (their breakdown could be further slowed by the fat content of the cookies). Either that coffee there didn't do anything and it was the \"slow\" carbs in the cookies that kept the blood sugar levels high for a little while, or the person added some sugar to their coffee. I am leaning to the former, because the simple sugars in coffee would have spiked his BG higher, especially given the fact that caffeine increases the absorption rate of glucose in the intestines. But why didn't the same thing occur at 12:00? One can make multiple hypotheses here. First, note that the body becomes insulin-resistant during mornings (this is called the dawn phenomenon), so it is easier for food to cause a spike in BG in the morning vs the noon. Second, the insulin resistance wears off around the noon, but this person still has a lot of insulin left in his system, so the effect of the \"slow\" carbs in the cookies becomes less conspicuous. Third, the person may have been physically active---which would have further increased his insulin sensitivity. A similar thing happened during dinner: first the potato and the donuts spiked his BG, then the complex carbs in the croutons and donuts kept it high for a while. Also note that the blood sugar levels crept up a little higher for a while starting at 21:00. I bet that's because the person became sedentary, which increased his insulin resistance, and his digestive system was still releasing glucose to the bloodstream. Thankfully, this is a healthy person, so it didn't go too high---but you can see his pancreas working hard for at least 2 hours after 21:00 to keep his BG low.")

![Too many calories](./img/calorie_madman.png#center "I wonder who this madman is with more than 20 thousand caloric intake. Forgive the extra zeros in the numbers preceding 25000, this was an intern under a lot of stress (or I misunderstood the meaning of numbers on the horizontal axis).")

![Age Distribution](./img/hpp_ages.png#center "I suppose it was better to be denied access to this dataset after all, because it wouldn't have been helpful for folks like me in their 20s (in addition to the fact that most of these people are non-diabetic).")

You may read [the paper here](https://arxiv.org/abs/2408.11876), and here's [the Gemini conversation](https://aistudio.google.com/app/prompts?state=%7B%22ids%22:%5B%221Ao2U3bKlmi50Xx9uIiArZPaAsH8VoASl%22%5D,%22action%22:%22open%22,%22userId%22:%22104194944460338666484%22,%22resourceKeys%22:%7B%7D%7D&usp=sharing).

> Note: I ran out of tokens for Gemini Pro, so I used the Flash variant. I am not sure to what extent that degraded the quality of the summary.

I know that I may have been too harsh in my treatment of these papers---after all, they were written by researchers under constant duress and pressure to publish.
But we can learn a thing or two from their mistakes. It seems to me that the researchers didn't engage the patients at all.
A lot of these models look like they were designed for the needs of healthcare professionals, not the patients. But do the doctors actually use these models?
I haven't met an endocrinologist (so far) who told me to change my regimen based on the output of some model.
I don't think that any of these models has ever helped me manage my diabetes---if anything, reading these papers gave me high blood sugar.

### Where Are The Models?

![Where are the models William?](./img/where_are_the_models.jpg#center)

If you search for blood sugar prediction methods in Google Scholar, you will receive a plethora of results. So, the natural thing to ask is: where are they?
I don't have a dropdown menu in my CGM app where I can choose a model to predict my BG. In apps that do predict BG, the name of the model
is not revealed and the predictions themselves are usually paywalled. The researchers write their papers and publish their RMSE scores and discuss how much better their model is
than the previous ones and graciously provide us with the equations for calculating accuracy, etc., but then, nothing...

This is the Fermi Paradox of BG prediction models---there are plenty of them in Google Scholar, but none on my smartphone.

## Simulating Type 1 Diabetes

The datasets used in training these models are seriously lacking. Usually they have only the blood sugar readings, and that's it. If you are lucky,
you may find one where the patients also logged their meals, insulin boluses, etc. But even then, the way the meals are logged
is often too simplistic. "I consumed 20 grams of carbs this morning" doesn't tell me much about what kind of carbs you ate. They can also
be unreliable: are we sure that the patient's estimation of the carb amount is correct? There can be missing values, e.g. times when
the CGM malfunctioned or the patient simply forgot to log a meal (which is more likely considering that diabetics are already
stressed).

The researchers try to overcome these limitations by coming up with solutions ranging from simple (using linear interpolation to approximate the missing data) to complex (using
a variational autoencoder to generate the missing points). I don't think that these datasets can be used to test the predictors either---if your model predicts the curve for
the insulin sensitivity factor, how do you test it on a dataset that doesn't provide it?

The only way to train a model that can answer "what-if" questions is to first **simulate** the
T1DM patients **applying** those hypothetical what-ifs in a virtual environment. Because there is a high-degree of inter-patient variability,
this dataset should contain a sufficiently large variety of **responses** to such what-ifs so that the base model will grasp the gist of what type 1 diabetes is, e.g.
by learning how different factors like insulin and exercise affect the blood sugar levels.
To improve its accuracy, this model would then further be fine-tuned on a per-patient basis.

### Sims But Everyone Is Diabetic

How do you simulate a T1DM patient? One way to do it is by **physiologically**. That is, the patient is simulated based on how
their body works as a function of time, for example by calculating the rate at which the carbs from a meal is absorbed in their intestines. We can
simulate the patient **physiologically** by building a **computational model** of the **human metabolic system**. This is what the [UVA/Padova Simulator](https://pmc.ncbi.nlm.nih.gov/articles/PMC4454102/) does.
You can play with it [here](https://lt1.org/simulator/).

![Some of the parameters of UVA/Padova](./img/uva_padova_parameters.png#center "These are only some of the parameters of the UVA/Padova simulator. I have no idea what my body's parameters are, and I bet these values can also change over time.")

UVA/Padova is the simulation of what is going on **inside** the body of a T1DM patient. But I'd argue that just as important is what is going on **outside** the
body. The psychology of the patient has a direct effect on their blood glucose levels. Perhaps the reason for why the patient frequently experiences midnight hypos is
because they like to exercise before going to bed. Or maybe the reason for why the patient's BG fluctuates so often is due to their inconsistent eating habits.
A behavioral simulator simulates the patient based on how their **mind** works as a function of time. Therefore, a model trained on the outputs of such a simulator
would learn to map the patient's psychology to their BG levels---it would become the Jungian shadow of the T1DM patient. Although the model would be worse
at the **physiological** modeling of the patient's body at first, I'd say that this would be compensated with continuous fine-tuning. In any case, the model would
allow the patient to see which behaviors they would need to change to stay in target---not just how much insulin they need to bolus for dinner.

### Building A Behavioral T1DM Simulator

> Reminder: Claude's outputs `look like this`.

Instead of generating blood sugar values per se, what if instead we generate the **factors** that affect the blood sugar?
For instance, one of the factors is carb intake. And instead of specifying carbs in grams, we can generate curves
for different types of carbohydrates---while the area under the curve would be the same for both 20 grams of carbs in bread
and 20 grams of carbs in orange juice, the curve for the orange juice would rise and fall at a much faster rate than that of bread.

`You're basically modeling glycemic index as a curve shape while keeping glycemic load (area under curve) tied to grams. A simple way to parameterize this: use a gamma distribution or a log-normal, where you control the peak time and the spread independently. Bread might peak at 45 minutes with a wide spread; juice peaks at 15 minutes with a narrow one. Same AUC, different shapes.`

Another factor is how sensitive to insulin the body currently is. This could be a multiplier, i.e. if its value is 2.0, then
the carb intake of 20 grams is actually counted as 40 grams.

`Insulin sensitivity as a multiplier is a reasonable simplification, but I'd push you to think about whether it should be static or time-varying. In reality, sensitivity follows a diurnal pattern (dawn phenomenon, for instance). If you make it a slowly-varying curve rather than a constant, you capture a lot more realism without much added complexity. You could even drive it with a simple sinusoidal + noise model.`

The third factor is exogenous insulin intake. This is specified in units, and it also comes with its own curve, i.e. long-acting and short-acting
insulin variants have different curves.

`Rapid-acting (Humalog/NovoRapid) peaks around 60–90 minutes and tails off by 4–5 hours. Long-acting (Lantus/Tresiba) is nearly flat over 24 hours. Again, parameterized curves work well here.`

Because some amount of insulin always needs to be present, I will use a "trick" where the simulator will assume some amount of food is being consumed at all times,
so the insulin will act against this "food". I consider the liver dumping sugar into the bloodstream a "feeding session".

`The basal glucose / liver dump idea is not a trick at all. Hepatic glucose output is a real physiological process and is exactly why basal insulin exists. Modeling it as a constant (or slowly varying) "feed" is what the minimal models do too. The key insight is that in a fasted state, the liver is producing roughly 1.5–2 mg/kg/min of glucose, and basal insulin is counteracting that. So your "phantom food" is physiologically grounded.`

Exercise can be modeled as food going out of the bloodstream into the cells.

`The subtlety is that exercise also increases insulin sensitivity for hours afterward, so it has both an immediate effect (glucose uptake into muscles) and a delayed effect (the multiplier drops). You might model it as two components: an acute negative carb-equivalent and a temporary reduction in the sensitivity factor.`

Like I mentioned before, I think the output of the simulator shouldn't be the blood sugar levels per se, but rather the factors (modeled as curves) affecting the blood sugar---such that when these factors are "combined" together they reveal the **rate of change** in the blood sugar level.

`The delta composition needs care. Are you summing the factors linearly? In reality, insulin and carbs don't just add — insulin acts on the glucose that carbs produce. So the interaction is more multiplicative or at least nonlinear. A simple approach: compute carb effect × sensitivity factor as "effective glucose load," then subtract the insulin effect. The delta is roughly (effective_glucose_in - insulin_driven_glucose_out) per time step.`

Perhaps we can set a seed and an initial value for the blood glucose level, then generate BG deltas ad infinitum?

`For the seed-based generation, you'll want to define what the seed controls. I'd suggest it determines the scenario: meal timing, meal types, insulin doses and timing, exercise events, and the sensitivity profile for the day. Then the simulator deterministically rolls those out. You could add process noise on top to simulate sensor error or physiological variability.`

My reasoning for building this simulator is to train a predictor on its outputs---hoping that the predictor will learn the relationships between the different factors and their cumulative effect on blood sugar.

`Sure, but if the simulator is too simple, the predictor might learn the simulator rather than real physiology. If your end goal is real BG prediction, you'd eventually want to validate that the synthetic training data produces a model that transfers to real CGM data. But as a pretraining or data augmentation strategy, this could be genuinely useful.`

Exercise is tricky. In my experience only aerobic exercise (e.g. walking) does a statistically significant reduction in blood sugar levels, not strength training.
But I have also heard from other patients that exercising increases their blood sugar. So this seems to be a per-patient effect.

`The aerobic vs. anaerobic distinction you mentioned is real — high-intensity exercise can spike BG due to cortisol and adrenaline, while steady-state aerobic exercise draws it down. Modeling walking as negative food intake with a magnitude proportional to duration and intensity is a clean starting point. You can always add a "stress response" exercise type later that acts as positive food intake for strength training scenarios.`

My idea is to teach the predictor the relationships between carbs (refined and complex), insulin injections (basal and rapid), insulin sensitivity (due to many factors), etc. and their "combined" effect on blood sugar.
But, the side effect of training the predictor on the output of a behavioral simulator is that the predictor will also learn the psychology of the given patient.
When you think about it, it predicts **patient behavior** rather than the actual blood sugar levels---the blood sugar becomes the outcome of patient behavior, and the trends
in the blood sugar levels begin to reflect the trends in the psychology of the patient.
Eventually, the pre-trained model will be continuously fine-tuned as behaviors change over time.

`Interesting.`

Should I fine-tune the model continuously on past patient data, or should I make a large context window (say 120 days), and have the model predict the patient's future behavior based on their past behavior?

`I'd argue these aren't mutually exclusive, but they serve different purposes. The large context window approach (feeding 120 days of history as context) is appealing because it's more like in-context learning — the model adapts to the patient without changing weights. This is simpler operationally (no retraining pipeline on-device) and avoids catastrophic forgetting. But it puts a heavy burden on the model to extract patient-specific patterns from raw history during inference.`

`Continuous fine-tuning gives you a genuinely personalized model, but it's harder to manage: you need to decide how often to update, how to prevent overfitting to recent behavior, and how to handle distribution shift (patient changes habits, gets sick, changes insulin type).`

`My suggestion: start with context-window-based personalization. It's simpler, and for a small model, you can afford a reasonably long context. If that hits a ceiling, then explore lightweight fine-tuning — maybe LoRA-style adaptation where you're only updating a small number of parameters per patient.`

Regarding the seed, my idea is to initialize a PRNG with it such that I can then use the PRNG to deterministically sample from a normal distribution.
For instance, the morning is defined between 4 am and 12 pm. The median is 8 am, and most people wake up sometime around then. There are few people who wake up very early or very late.

As a matter of fact, I want to model almost everything using normal distributions, including:

1. The patient's ability to correct their lows and highs (with most people being okayish, and few people being either excellent or terrible at it).
2. The patient's food preferences per meal.
3. The patient's exercise habits (since many types of exercise exist and they all cause different effects on blood sugar, my goal is to first start with walking, since I know that walking will definitely make the blood sugar levels drop and hence can be reduced to negative food intake).

I will also add some randomness to the generated curves, so that the model focuses on the relationships, not the actual values. What do you think?

`Using normals for wake times, meal times, correction behavior, and so on is a good starting point, but consider that many of these are better modeled as truncated normals or even mixtures. Wake time is a good example: most people cluster around 6–8 AM on weekdays but shift to 8–10 AM on weekends. A mixture of two normals captures this much better than one.`

`Regarding the correction behavior, a patient who over-corrects lows (eats too much sugar) creates rebound highs; a patient who under-corrects highs (gives too little insulin) stays elevated for hours. This is arguably where most of the real-world BG variance comes from — not the physiology, but the behavioral response to the physiology. Parameterizing this along a skill axis from "terrible" to "excellent" with most people in the middle is a great way to generate diverse training data.`

`A few specific suggestions on how to add noise: for curve shapes, vary the peak time and spread parameters (not just the amplitude); for insulin sensitivity, add both a slow drift component (day-to-day variation) and a faster noise component (meal-to-meal variation); for meal timing, jitter the meal onset time since even habitual eaters vary by 30–60 minutes day to day.`

`Your simulator will need some notion of BG "memory" or momentum. A patient at 300 mg/dL who takes a correction dose behaves differently (in terms of delta trajectory) than a patient at 150 mg/dL taking the same dose, because insulin sensitivity itself changes at extreme BG values (glucose toxicity at highs, counter-regulatory hormones at lows). You could handle this by making the sensitivity curve also a function of recent BG history, which adds a feedback loop into the simulator. This makes the dynamics more realistic but also more complex — worth considering whether to include it in v1 or defer it.`

Perhaps we can "save" the predicted factor curves, and during inference we make the model consider not only these curves but also the observed blood sugar levels? The model will still predict the factor curves only, but the inclusion of the previous blood sugar values will provide contextual information.

`You're giving the model an observational signal without asking it to directly predict BG. It can learn things like "when BG was high two hours ago and a correction was given, the insulin curve effect should be stronger" without needing to model the BG dynamics explicitly. The model stays focused on what it's good at (predicting behavioral patterns and factor curves) while still being informed by outcomes. This is essentially a partially observed system where BG acts as an indirect feedback channel.`

During the calculation of the final blood sugar level, I think it would be better to make the amount of noise proportional to the value itself, as CGMs become increasingly unreliable the higher the blood sugar levels rise.

`Most CGMs measure interstitial glucose, not blood glucose, and the lag and error both increase at extremes. MARD (mean absolute relative difference) is typically reported as a percentage, which means the absolute error at 300 mg/dL is much larger than at 100 mg/dL. You could model this as additive Gaussian noise where the standard deviation is proportional to the BG value — something like σ = 0.1 × BG would give you roughly 10% MARD, which is realistic for current CGMs. There's also a time lag of roughly 5–15 minutes between blood and interstitial glucose, which you could model as a simple delay if you want that extra realism.`

How do we jitter the timing of each meal?

`A normal with mean 0 and standard deviation of maybe 20–30 minutes for habitual eaters, wider for less structured eaters, captures meal timing variability well. Disciplined patients have tighter meal schedules, less disciplined ones are all over the place.`

So many processes occur during exercise that I think it is hopeless to simulate it. But maybe if I model it as "negative food intake" and the patient exercises routinely, then maybe the model will learn:

1. Approximately during when the patient likes to exercise.
2. How much lower do their BG drop when exercising.

`I think this is the right level of pragmatism. You don't need to simulate the VO2 max, cortisol response, and glycogen depletion. You need the model to see "around 6 PM on most days, there's a negative food event of roughly this magnitude and duration." The model learns the pattern and its BG consequences. If a real patient exercises at roughly the same time and intensity, the model will pick that up from their history. What matters is that the training data contains diverse enough exercise patterns (timing, duration, magnitude) that the model has seen something similar to what any given patient does.
`

I want each patient to have a "skill" parameter. My idea is as follows:

1. I assume that those who are really good at regulating their blood sugar levels are also very good at bunch of other things, i.e. they have good habits in general. So their starting blood sugar levels are in range, they like to exercise a lot, eat meals with fewer carbs, and frequently check their CGMs and make corrections if necessary.
2. I assume that those who are really bad at regulating their blood sugar levels are also very bad at bunch of other things, i.e. they have bad habits in general. Their starting blood sugar levels are already high (or very low), they don't exercise that much, they eat frequently and inconsistently (and prefer meals with lots of refined carbohydrates), rarely check their CGMs, and even when they do, they often fail at making the right corrections.
3. I assume that those who are okayish at regulating their blood sugar levels are also average at bunch of other things. Their blood sugar levels are somewhat at range, they exercise sometimes, eat okayish, and check their CGMs mostly when they beep (i.e. for very low and very high blood sugar levels). They are in general not too bad at making corrections.

`The pitfall is that real patients are more heterogeneous than a single axis allows. You get patients who are meticulous about insulin dosing but eat terribly. You get patients who exercise obsessively but refuse to check their CGM. A single skill parameter forces all these behaviors to be correlated, which means the model might struggle with real patients who are "good" on some dimensions and "bad" on others.`

`A potential middle ground: instead of one skill parameter, use maybe three to four semi-correlated skill dimensions — something like dietary discipline, correction responsiveness, routine consistency, and exercise commitment. Sample them from a multivariate normal with positive correlations (so they tend to move together, matching your intuition) but allow for independent variation. The correlation coefficient controls how tightly coupled they are: set it at 0.7–0.8 and you get mostly-correlated archetypes with enough divergence to cover the heterogeneous cases. This doesn't add much complexity to the simulator, but it would make the training data substantially richer.`

I wonder if the simulator will be good enough to generate a sufficiently diverse training dataset.

`Since everything is seed-driven and parameterized by normals, you can generate an essentially unlimited amount of diverse training data. But I'd suggest also generating some "adversarial" scenarios that might be rare under your normal distributions but are critical for the model to handle: missed insulin doses, double doses (accidental), illness days (where sensitivity drops dramatically), very large meals, extended fasting, and so on. You could add these as a small percentage of your training data by occasionally overriding the normal sampling with extreme values.`

So the skill parameter is kind of a meta-parameter that will influence the way the curves are generated?

`Yes, the skill parameter is a meta-parameter that shapes everything.`

You mentioned the advantages of having multiple skills. What do you think those skills should be?

`First, dietary discipline — controls carb amounts, meal regularity, carb type preferences (fast vs. slow), and meal count. High discipline means consistent, moderate, lower-carb meals. Low discipline means irregular, large, high-glycemic meals.`

`Second, attentiveness — controls how often the patient checks BG / responds to CGM alerts, how quickly they notice highs and lows, and whether they track IOB. High attentiveness means frequent checking, quick response. Low attentiveness means long delays before noticing problems.`

`Third, dosing competence — controls accuracy of carb counting, correctness of insulin-to-carb ratio application, understanding of IOB and stacking risk, and appropriateness of correction doses. High competence means accurate dosing and patience. Low competence means miscounting, stacking, and over/under-correcting.`

`Fourth, lifestyle consistency — controls regularity of sleep/wake, exercise habits, meal timing variance, and stress patterns. High consistency means predictable routines. Low consistency means chaotic schedules.`

An unskilled patient is also different in the sense that they can start panicking when experiencing dangerously low blood sugar levels.

`When a patient goes low, the amount they eat to correct is also skill-dependent. A competent patient eats 15 grams of fast carbs and waits 15 minutes (the standard "rule of 15"). An anxious, low-competence patient in a hypo panic eats everything in sight — 60+ grams of fast carbs — and then rockets to 300 mg/dL. You could model the correction amount as a function of the severity of the low times a "panic factor" that's inversely related to competence. The worse the low and the less competent the patient, the more they over-eat.`

Build this simulator and the accompanying visualizer in python. The simulator will be the engine, and the visualizer will let me see the results of the simulation.

`Will do.`

### T1DMSIM: A Behavioral T1DM Simulator

I have published the source code and the instructions for running this simulator [on Github](https://github.com/0xdeadf1sh/T1DMSIM).
It's quite performant---you can generate weeks of patient data in mere seconds.

Here is a segment from patient #89430:

> Note: 89430 is the seed that was used to create this patient:

![Patient 89430](./img/patient_89430.png#center "Patient #89430")

The curves are color-coded:

- The orange curve is the glucose getting absorbed into the bloodstream.
- The blue curve is the amount of insulin present in blood.
- The purple curve is the body's sensitivity to insulin.
- The red curve denotes exercise.
- The green curve is the final blood sugar.

Notice how the patient became hypoglycemic after exercising, and then corrected it by (presumably) drinking some juice.

![Patient 85141](./img/patient_85141.png#center "Patient #85141")

Here you can see that the patient bolused for some food, but it wasn't enough, so he bolused again.

![Patient 58953](./img/patient_58953.png#center "Patient #58953")

This is a common pattern for me. I eat dinner, only to realize that I didn't bolus enough, so I bolus again, but
the dose is miscalculated, so I sleep through the night with high blood sugar.

![Patient 69715](./img/patient_69715.png#center "Patient #69715")

This patient forgot his basal insulin. His blood sugar skyrocketed during sleep. He woke up, saw that his
blood sugar is very high, got angry (at himself), and rage bolused. This emotional reaction drove him toward hypoglycemia.

![Patient 87143](./img/patient_87143.png#center "Patient #87143")

This person bolused too much basal insulin, so his blood sugar crashed at night, but he was saved by the dawn phenomenon (and the waning basal in his system).

![Patient 92139](./img/patient_92139.png#center "Patient #92139")

This person had too much insulin in his body. He had to wake up multiple times during the night to correct his hypos. He went to work with baggy eyes.
Notice how he reduced his basal dose the next morning.

![Patient 2648](./img/patient_2648.png#center "Patient #2648")

This patient is really good at controlling their T1DM.

![Patient 64775](./img/patient_64775.png#center "Patient #64775")

This patient is also good, but they like to keep their BG a little high to minimize their risk of hypo. Maybe he's operating heavy machinery and this
is the strategy that he came up with?

![Patient 75116](./img/patient_75116.png#center "Patient #75116")

This patient is struggling.

I think this is fine (the simulator, not the fact that patient #75116 is struggling), but it is hard to tell whether the generated datasets
will be useful.

`The biggest concern is whether the synthetic data will produce patterns diverse enough for the model to generalize. The current parameter space generates a reasonable variety of patients, but all patients follow the same structural rules (gamma-shaped meals, flat basal, sinusoidal IS). A real CGM dataset has far more chaotic, irregular patterns. You might want to occasionally inject "rule-breaking" events — a meal that absorbs in a completely unusual way, an insulin dose that acts faster or slower than expected, a random unexplained BG spike (which happens constantly in real life and drives patients crazy). This would make the model more robust to real-world noise.`

Do it.

`I will add the necessary modifications and do some final tests.`

## Training Qwen3 (.5?) On Blood Glucose

As you remember, a lot of the research we have looked at tried to either:

- Train a very old GPT-2 style transformer, or,
- Train multiple models duck-taped to each other with weird modules.

So, here's my proposal. How about:

![Patrick Wants To Train Qwen On Blood Sugars](./img/patrick_bloodsugar.jpg#center)

Well, technically, the **factors** that affect the BG, but you get the idea.

### Discussing The Architecture With Claude

`Qwen 3.5 is a text model — its input pipeline is tokenizer → embedding lookup → transformer blocks. You need to replace the front end entirely for continuous-valued time series input.`

Indulge me.

`At each 5-minute step, your simulator produces a vector of, say, 6–8 floats (carb intake, bolus insulin, basal insulin, insulin sensitivity, exercise, maybe CGM reading and BG delta). Rather than discretizing these into bins or using a tokenizer, the cleanest approach is a linear projection input layer: concatenate all channel values at each timestep into a vector x_t ∈ ℝ^d_input, then project via a learned linear layer to the model's hidden dimension h_t = W_in · x_t + b. This gives you one "token" per 5-minute step.`

We also need to tell the model what time it is.

`Add temporal positional encodings. Standard sinusoidal or RoPE embeddings work, but consider encoding several time features explicitly: time-of-day (critical because of the diurnal IS pattern), day-of-week (weekend behavior differs), and days-since-sequence-start. You can either concatenate these as extra input channels or add learned periodic embeddings.`

The original architecture outputs text, so we need to handle this, too.

`Replace the language model's vocabulary projection with a multi-head regression layer: one output head per predicted curve channel. Each head is a small MLP (hidden dim → 1 or 2 layers → 1 float). You probably want to predict all channels simultaneously at each step. The loss would be MSE or Huber loss per channel, with channel-specific weighting since the scales differ (carb grams vs. IS factor vs. insulin units).`

This model will also need to be able to run comfortably on most smartphones.

`A model in the 20–50M parameter range should give you real-time inference (under 100ms per prediction) even on older phones, and a 100–200M model would still be very comfortable on modern devices.`

Should we use MoE? I am thinking that maybe each expert would specialize in learning the patterns of a distinct group of patients with shared behavior. Thus,
during inference, the model figures out what kind of patient it is dealing with, and only activates the parameters responsible for the closest matching archetype.

`Your intuition about different experts for different patient types is interesting but likely incorrect in practice. MoE routing is learned, not assigned — there's no guarantee experts would specialize by patient archetype. More importantly, MoE shines when you need a very large capacity model but want to keep compute per token low. At your scale (20–50M params), you don't have the parameter budget to make MoE worthwhile — the router and multiple expert FFNs add overhead that isn't justified. If you later scale to 500M+ and find that a dense model struggles with patient diversity, revisit MoE then.`

Based on the discussions that we have had so far, how large do you think that this model should be?

`Your input is structured and relatively low-dimensional (6–8 channels). The patterns are complex but regular — diurnal cycles, meal responses, correction behaviors. This is much less complex than natural language. I'd start with something in the 30–80M parameter range: maybe 8–12 transformer layers, hidden dimension 256–512, 4–8 attention heads. This is far smaller than any Qwen 3.5 variant, but that's appropriate — you're solving a different kind of problem.`

I need something concrete.

`Start at ~40M parameters (8 layers, dim 384, 6 heads), train it, evaluate, and scale up only if you see clear underfitting.`

Can we compress the sequence length?

`Rather than one token per 5-minute step (which gives 288 tokens/day), group consecutive steps into patches of, say, 4–6 steps (20–30 minutes). This reduces sequence length by 4–6× and lets each token carry richer local context. PatchTST demonstrated this works well. With patches of 6, a 7-day window becomes ~336 tokens instead of ~2016.`

Some of the factors also affect each other, e.g. exercise may reduce IS.

`Instead of flattening all channels into one token per timestep, consider a two-axis attention scheme: temporal attention across timesteps and channel attention across factor types. This is similar to how time-series transformers like PatchTST or iTransformer work. The "inverted" approach (where each channel is a separate token sequence and attention operates across channels at each timestep) has shown strong results for multivariate forecasting. This would let the model explicitly learn that insulin and carbs interact, that exercise affects IS, etc.`

What about the loss function?

`Weighted sum of per-channel MSE. Weight the channels by importance — IS prediction errors compound over time, so you might weight IS higher. Consider also a "BG-derived" auxiliary loss: run the predicted curves through your BG delta formula and compare the resulting BG trajectory to the true one. This gives the model a signal about whether its predicted curves jointly produce realistic BG behavior, even though BG isn't a direct output.`

And the context window size?

`7–14 days of context (336–672 patch-tokens), with a prediction horizon of 4–12 hours (8–24 patch-tokens). Train on 7 days initially. The patch approach is critical here — without it, 14 days would be ~4032 tokens, which is feasible but slower to train.`

`With a 7–14 day context, the model sees enough of a specific patient's patterns to implicitly adapt. The attention mechanism can pick up on "this patient always eats late," "this patient's dawn phenomenon is severe," etc. This is zero-shot personalization — no weight updates needed, just feed in the patient's recent history. This should be your baseline approach.`

Sure, but I still think that a deeper personalization is needed.

`The base model might be 40M parameters, and a LoRA adapter with rank 4–8 on the attention projections would add only ~100K–500K trainable parameters. This is absolutely feasible to fine-tune on a smartphone — you'd accumulate a few weeks of the patient's real data, then run a few epochs of LoRA training overnight while the phone is charging.`

We will need to be careful about the data---these will function as medical records, so I don't want anyone other than the patient to have access to them.

`Since all inference and fine-tuning happen on-device, the raw BG and behavioral data never leave the phone. The base model (trained on synthetic data) is distributed as part of the app. The LoRA weights are local to the device. This is a clean privacy story.`

How do you think the model should predict these curves?

`Rather than predicting a single future trajectory, predict a distribution — output the mean and variance (or quantiles) for each channel at each future timestep. This is critical for clinical utility: "your BG will probably be between 90–140 in 2 hours, but there's a 15% chance it exceeds 180" is far more useful than a point prediction. You can do this by having each output head predict (μ, σ) and training with a Gaussian negative log-likelihood loss, or by predicting quantiles (10th, 50th, 90th percentile) with quantile regression loss.`

Hmm, I wonder whether we could also teach the model to distinguish between the patients, like the GluFormer paper did.
These could allow us to do long-term predictions for a specific patient belonging to some cohort. And if the patient changes their behavior,
we can show them that they have indeed "switched" to another cohort, or that they are moving toward it.

`Add a learned patient-ID embedding vector to each token. During training on synthetic data, each seed gets its own embedding. During fine-tuning, the patient gets a new embedding that's learned alongside the LoRA weights. This gives the model a compact representation of "who this patient is."`

What is the difference between adding temporal positional encodings as extra input channels vs learned periodic embeddings?

`Explicit channels are more transparent and work well when you know the relevant periodicities (you do — 24h diurnal cycle, 7-day weekly cycle). Learned embeddings are more flexible but need more data to discover the same structure. For your case, I'd go with explicit sinusoidal channels for time-of-day and day-of-week. You know these matter, and your model is small enough that you want to give it every structural advantage rather than making it learn obvious things.`

Yeah, I don't think that I have enough compute to justify a brute-force approach. By the way, should we use Huber loss or MSE?

`MSE penalizes large errors quadratically, so outliers dominate the gradient. Huber is linear beyond a threshold (delta), so it's more robust to outliers.`

`That said, once you add probabilistic outputs, the loss changes to negative log-likelihood anyway, and the variance head naturally handles outliers.`

How should the model attend to the patient's history?

`Use a bidirectional encoder with a multi-step regression head. Process the entire history bidirectionally, take the final hidden states, and project them through an MLP that outputs all prediction-horizon timesteps at once (not autoregressively). This is simpler, faster at inference, and avoids error accumulation from autoregressive prediction. The downside is that the predictions at different future timesteps are somewhat independent — the model can't condition its 2-hour prediction on its 1-hour prediction.`

It is also important that the model understands how the factors affect each other throughout the patient's BG history.

`Alternate between temporal attention layers (tokens = timesteps, attention across time) and channel attention layers (tokens = channels, attention across channels). Stack blocks of (temporal self-attention → channel cross-attention → FFN). The temporal attention captures "what happened before this timestep," and the channel attention captures "how do these factors interact at/around this timestep."`

Can you elaborate on patching?

`Without patching, each 5-minute step is one token. 14 days = 14 × 288 = 4032 tokens. Attention is O(n²), so this is expensive.`

`Patching groups consecutive timesteps into one token. With patch size P=6 (covering 30 minutes), you take 6 consecutive input vectors and combine them into one token.`

`Mechanically: say your input at each step is a vector of 8 values. Six consecutive steps give you a matrix of shape (6, 8). You flatten this to a vector of length 48, then project it through a linear layer to the model's hidden dimension (say 256). This single 256-dim vector is now one patch-token representing 30 minutes of data.`

`14 days = 4032 steps / 6 = 672 patch-tokens. Attention cost drops by 36×.`

`Within a 30-minute window, the values are fairly smooth — carb absorption doesn't change dramatically over 30 minutes. The patch captures the local shape (is it rising? falling? flat?) and the attention mechanism handles the long-range dependencies (what happened 3 days ago that's relevant now).`

`The tradeoff: you lose temporal resolution. Your model can't make predictions at finer than 30-minute granularity from the patched representation. For prediction output, you can either predict patches (30-min chunks of all channels) and then interpolate, or use a different (finer) resolution for the decoder. For a clinical use case, 30-minute prediction granularity is probably fine — patients don't need minute-by-minute forecasts.`

`One important detail: stride. You can use overlapping patches (stride < patch size) for smoother representations, but non-overlapping patches (stride = patch size) are standard and work well.`

Regarding input channels, the simulator calculates the curves for carbs, insulin, and exercise.
But the simulator also generates the insulin sensitivity curve. Now this the patient doesn't really know, so I think it would be better for the model to predict this too.
The past predicted values for the insulin sensitivity curve can then be fed back to the model as it continues to generate new curves.

But here's an interesting problem: during inference (assuming that the model has already been trained and deployed) if there is an error in blood glucose estimation,
would that be because the patient miscalculated the amount of carbs, or, because the model miscalculated the insulin sensitivity curve?
I made sure that the simulator adds some variation to fast-acting bolus curves---since different injection sites may have different absorption rates.
Perhaps this is where in-context learning will shine? That is to say, the model may figure out that during evenings the patient likes to inject in a place where the absorption rate is lower.

`If BG came out higher than expected, it could be because the patient ate more than they logged, or because their IS was higher than the model predicted, or because the bolus absorption was slower. The model can't distinguish these from BG data alone.`

`But if the model sees that every evening, the BG response to meals is consistently stronger than the carb/insulin inputs would suggest, it can learn two possible explanations: (1) the patient systematically underestimates evening carbs, or (2) the patient injects in a site with slower absorption in the evening. The model doesn't need to know which — it just learns to predict the resulting pattern. Over 14 days of context, these systematic biases become visible.`

`I'd suggest making the model predict IS and carb absorption rate as separate output channels. When fine-tuned on real patient data, the model will settle on some decomposition that explains the observed BG. It might not be the "true" decomposition, but it will be predictively accurate, which is what matters for forecasting.`

Exercise is very hard to model. Some exercises decrease blood sugar, some increase it. In my simulator, I have a simplified approach where I focus only on aerobic exercise (since in my experience this has always decreased my blood sugar levels, in contrast to anaerobic exercise which has more inconsistent effect).

`Anaerobic exercise (weightlifting, sprinting) can actually raise BG acutely via catecholamine-driven glycogenolysis, then lower it later — the dynamics are genuinely complicated and hard to model without heart rate / lactate data.`

`I'd represent exercise as a single input channel: the exercise curve from your simulator (negative carb-equivalent for aerobic). During fine-tuning on real data, if the patient logs exercise type and the model sees that some exercise sessions are followed by BG drops and others by BG rises, the in-context pattern will help it learn the difference — even without explicitly modeling anaerobic dynamics.`

I understand the idea behind "BG-derived" auxiliary loss, but should we really weight the channels by importance? Because I don't know what the weights should be. In fact, I am not even sure whether IS prediction errors do compound over time, and if they do, how much do they really?

`If you don't know the correct weights, uniform weighting is the safest default. The channels have different scales (carbs in grams, insulin in units, IS as a multiplier around 1.0), so you should normalize each channel (e.g., divide by the training set standard deviation for that channel) so that equal loss weight means equal relative importance.`

`The BG-derived auxiliary loss is a separate matter — it provides a holistic signal that complements the per-channel losses. I'd add it with a small weight (say 0.1× the total per-channel loss) so it acts as a regularizer rather than dominating the training.`
 
I have also added "rage" behavior to my simulator---the patient rage boluses or eats too many carbs due to frustration and/or stress, something that I have experienced a few times myself, so I am curious whether the model will be able to anticipate this kind of behavior?

`Your simulator generates it with specific triggers (very low or very high BG + low skill), so the training data will contain examples. I'd expect the model to learn "BG below 55 → probable large carb spike soon" but maybe not the exact magnitude. Probabilistic outputs will help here — the model can predict high uncertainty during rage-likely situations.`

What do you exactly mean by prediction horizon?

`When I say "prediction horizon," I mean: during training, how many future timesteps does the model predict in one forward pass? This is a design choice, separate from what the model can predict at inference.`

`If you train with a 2-hour prediction horizon (4 patch-tokens), the model learns to output 4 future patches given the context window. At inference, it outputs those same 4 patches — 2 hours into the future. If you want to predict further, you'd feed the predictions back as input and run again (autoregressive over chunks).`

`If you train with a 12-hour prediction horizon (24 patch-tokens), the model directly outputs 12 hours of predictions in one forward pass. No autoregressive looping needed. But the predictions at hour 12 are conditioned on the context window only, not on the model's own predictions for hours 1–11 (in the encoder-only architecture).`

`I'd recommend training with a 4–6 hour prediction horizon. This is clinically useful (patients want to know "what happens if I eat this now") and short enough that prediction quality should be reasonable. You can always extend by rolling forward.`

Can we write the code for LoRA after the model has been trained? Or do we need to change some code in the training routine specifically for LoRA to work?

`LoRA is applied to an already-trained model — it freezes the base weights and adds small trainable low-rank matrices alongside the existing attention projections. You don't need to change anything in the training code for the base model. After training, you write separate LoRA fine-tuning code that loads the frozen base model and trains only the adapters.`

Your patient embedding idea gave me another idea: Wouldn't it be interesting to also extract such an embedding during inference,
and then perform dimensionality reduction to let the patient know where they "stand" in the population?
This would allow us to plot progress in the app: the high-dimensional patient embedding would be projected onto a 2D graph---showcasing
where the patient stands with respect to their skills (maybe they are very skilled in computing insulin dosages but unskilled in other areas).
We can extract these embeddings as time passes, then show the user the "velocity" of their progress.

Can you tell me how we can extract such an embedding for each patient during inference?

`During base model training on synthetic data, you add a patient embedding layer: a lookup table that maps each seed (patient ID) to a learned vector of, say, 32 or 64 dimensions. This embedding is concatenated or added to every token in that patient's sequence. The model learns to use this embedding to capture stable patient-level traits — essentially learning a compressed representation of the skill profile.`

`During inference on a real patient's device, there's no lookup table — the patient is new. Instead, you add a patient encoder: a small network (or even just a learnable vector that's optimized during LoRA fine-tuning) that produces the embedding from the patient's data. The simplest version: the patient embedding is just a trainable parameter that gets optimized alongside the LoRA weights during on-device fine-tuning. After fine-tuning, you extract this vector — it is the patient's representation.`

`For the visualization: you'd run the trained base model's patient embeddings (from all synthetic seeds) through UMAP or t-SNE to create the 2D map. Each point represents a synthetic patient, and you can color them by skill dimensions to create interpretable axes. When a real patient's embedding is extracted, you project it onto the same 2D space. As LoRA fine-tuning runs periodically (say weekly), the embedding shifts, and you plot its trajectory over time — that's the "progress velocity."`

`To make the axes interpretable, you can correlate the UMAP dimensions with the known skill dimensions from the synthetic patients. If UMAP axis 1 correlates strongly with dietary discipline and axis 2 with dosing competence, you can label them accordingly. This won't be perfect (UMAP axes aren't linear), but it gives patients intuitive feedback.`

`One design consideration: the embedding should be continuous, not discrete. Don't use a lookup table for real patients — use a learned vector that's part of the LoRA parameter set. This way, the embedding can represent any point in the space, not just one of the training seeds.`

If the loss is negative log-likelihood anyway, does Huber loss still matter?

`No, not really.`

Regarding your recommendation to use the encoder-only architecture with multi-step output, does this mean that the accuracy of the predictions is inversely proportional to how long the prediction horizon is? Kind of like how IEEE754 floating-point numbers work: more bits for the left side of the comma means less bits for the numbers after the comma.

`Your floating-point analogy is intuitive but not quite right. It's not that there's a fixed "accuracy budget" that gets spread thinner over longer horizons. It's more like compounding uncertainty.`

`At t+30 minutes, the model is predicting based on known recent history. The patient probably hasn't done anything new yet. Prediction is relatively easy.`

`At t+3 hours, the model must predict whether the patient will have eaten, bolused, exercised, or corrected in the intervening time. Each of those is uncertain, and the prediction depends on getting all of them roughly right. Errors don't dilute a fixed budget — they accumulate because each uncertain event changes the trajectory.`

`The encoder-only architecture doesn't make this worse than an autoregressive decoder would — in fact, it avoids one specific failure mode of autoregressive prediction, which is that errors in early steps get fed back as inputs and snowball. But it does mean each output timestep is predicted somewhat independently from the same context encoding, so the model can't say "given that I predicted a meal at t+1h, I should predict a bolus at t+1.5h." It has to predict both from the context alone.`

`In practice, for a 4–6 hour horizon, this is fine. The model can learn "if it's noon and the patient hasn't eaten, a meal is likely in the next hour" directly from the context. It doesn't need the autoregressive chain. If we ever push to 12+ hour horizons, we might want to revisit this.`

For the patient embeddings, if we use a look-up table, then wouldn't the size of this table get too big?
Oh wait, I now understand that the embedding is a vector, not the actual training seed---got it.

`Right, the lookup table maps patient index (not seed value) to a vector. During training, if you generate 10,000 synthetic patients, you have a lookup table of size 10,000 × 64 (if embedding dim is 64). The patient generated by seed 1,847,293 might be patient index 4,521 in your training set. The seed value is irrelevant to the embedding — the index is just an ordinal identifier.`

`The key question is how many distinct patients to generate for training. More patients = more behavioral diversity = better generalization, but also more embedding parameters and more data to process. I'd suggest 5,000–20,000 synthetic patients, each simulated for 14–30 days. At 20,000 patients × 64 dim, the embedding table is only ~5M floats (~20 MB) — negligible.`

Any questions for me?

`Let me make sure I understand the deployment scenario. The patient has a CGM that gives a BG reading every 5 minutes. They log meals (carb amount, roughly) and insulin doses (bolus amounts, basal rate). They may log exercise.`

`So the input channels during real-world inference are: observed BG (from CGM), known carb intake (from meal logs), known bolus insulin (from pump or manual logging), known basal insulin (from pump settings or injection schedule), and possibly exercise (from manual logging or watch).`

`The model then predicts: future carb intake (will they eat?), future bolus insulin (will they bolus?), future IS curve (latent), future exercise (will they exercise?), and implicitly future BG (via the auxiliary loss formula).`

`Is this right? And critically: when the patient asks "what if I eat 40g of carbs now?", do we inject that as a known future input and let the model predict the rest? That is, the what-if mode overrides certain future channels with user-specified values and the model fills in everything else?`

The inputs are specified as curves. I have an idea for training a YOLO-based model that will output these curves directly (image -> curve),
but we can discuss that later.

Note that there is one more input channel than there are output channels: the BG curve.
This won't get masked (unless you think that masking this would be beneficial).
I don't see a reason in preventing the user from messsing with their IS curve.

When designing the app, we could do something similar to Photoshop: have many layers, where the layer 0 represents the model's predicted curves,
but the user can create new layers such that each of them can override one of the curves with custom parameters. The curves are masked based
on which layers are active---if only the layer 0 is active, then the next prediction will be based on model's previous predictions; but if a custom layer
is active, then the model will condition its predictions given the user-specified curves from the active layers.

`How will you know the model is good?`

That is hard.
I mean, how do you test a model that predicts an IS curve on a dataset that only provides CGM outputs?
Food for thought. You may say that at least the "combined" output (which would be the final BG level) should match that of a real-world dataset,
but I'd argue that there would be more than one solution given a list of predicted curves such that their combined effects would amount to the same BG level.

`With 14 days of context, the first 14 days of each patient's simulation have incomplete context (day 1 has no history at all). Do you plan to discard the first 14 days of each simulation, or train with variable-length context (using attention masks to handle shorter sequences)? Discarding is simpler but wastes data. Variable-length is more work but lets the model learn to make predictions with limited history, which is valuable for real deployment (you can't wait 14 days before making predictions for a new user).`

Let's do 15 days of context, with a mandatory 24 hour initial context. During inference, we can assume that there will always be at least 24 hours of data.
I think the variable-length context would be more useful.

`You mentioned the app will let users modify curves, offset them, tune parameters. This means the model needs to accept partial future inputs — some channels are specified by the user (planned meal), others are predicted by the model (IS, possible corrections). Does the model need to handle arbitrary combinations of known/unknown future channels?`

Yes.

`I see.`

What if we use encoder-only + autoregressive for longer horizons? We can even do an 8-hour horizon to predict nocturnal hypoglycemia in one pass.

`Yes, this works well. The model predicts 8 hours ahead in one forward pass (16 patch-tokens at 30-min granularity). For predictions beyond 8 hours, you roll forward: take the predicted outputs, append them to the context window (dropping the oldest patches to maintain the 15-day window), and run again. Each roll gives another 8 hours.`

Can you be more concrete?

`The model outputs 16 patches. You concatenate these onto the input, slide the context window forward by 16 patches, and run again. The second pass sees the first 8 hours of predictions as "history" and predicts the next 8 hours. Error does compound across rolls, so predictions at 16+ hours will be noisier than 0–8 hours. The probabilistic outputs will naturally reflect this — σ² should grow with each roll.`

And if I check at 10 PM and want to predict through 6 AM ...

`... that's 8 hours — exactly one forward pass. Perfect fit.`

The interesting question is should we generate **many patients** each with a **small number of simulated hours**,
or should we generate **a small number of patients** but each with **many simulated hours**?
Note that the simulator samples the patients from a normal distribution, i.e. many of them will be similar,
and a small minority will be either very good or very bad at managing their diabetes.
Perhaps we should do 100 thousand synthetic patients and create 30 days of simulations for each?

`Both dimensions matter for different reasons. Many patients teach the model the breadth of behavioral patterns. Long simulations teach it temporal dependencies within a single patient (illness arcs, basal adjustments, weekly rhythms).`

`100,000 patients × 30 days is substantial: roughly 100K × 30 × 288 = ~864M timesteps, or ~144M patches. That's a lot of data for a small model — you might actually overtrain. But since generation is on-the-fly, you're effectively sampling from the distribution each epoch rather than memorizing fixed data, which acts as implicit regularization.`

I think we need to contend with the fact that our model will be good at predictions for consistent patients,
but worse at predicting the behavior of inconsistent patients.
So we won't achieve universally good accuracy across all cohorts. In fact, we could use the errors in predictions during inference as an additional signal about the patient's behavioral consistency.

`This also means your evaluation metrics should be stratified by patient skill level. Don't average MAE across all patients — report it by skill quartile. The model should have low error on consistent patients and appropriately high uncertainty (well-calibrated) on inconsistent ones.`

My worry is that, because we are sampling from a normal distribution, many patients will cluster around the mean---decreasing the number of "extreme" patients in the dataset, making it homogeneous.

`You could oversample the tails during training. A simple approach: with 50% probability sample normally, with 50% probability sample uniformly across the skill range. This ensures the model sees enough extreme patients to learn their patterns.`

How do we deal with user-specified curves?

`Run the model once to get baseline predictions. Override the user's channels. Run again with the overrides injected as known future inputs (masked as "observed" rather than "predicted"). The model's second pass adjusts its predictions for the non-overridden channels given the user's curves. Two passes should suffice for most scenarios.`

`For training, this means we should sometimes mask future channels during training — randomly reveal some future channels as known inputs and ask the model to predict the rest. This teaches the model the conditional prediction mode it needs for what-if scenarios.`

Testing this model will be something.

`You could start with a qualitative evaluation: do the predicted IS curves look physiologically plausible? Do they show dawn phenomenon? Do they respond to exercise? A clinician or experienced patient (you) can eyeball these.`

Can you elaborate more on how we will train this model?

`We will generate 30 days of simulation, use the first 24 hours as mandatory context, then create training windows starting from day 2 onward with variable context length from 24 hours up to 15 days.`

Can you be more concrete?

`The first training window has 24h context + 8h prediction. The next (shifted by, say, 8 hours) has 32h context + 8h prediction. By day 15, windows have the full 15 days of context. This teaches the model to work with any context length from 24h to 15 days.`

`During training, we use attention masks to handle variable-length context within a batch. Shorter contexts are padded and masked. This is standard transformer practice.`

Should we make the input channels use absolute units, but make the output channels produce deltas?

`I'd argue against it. If the model predicts carb deltas, the actual carb curve is the cumulative sum of predicted deltas. A small systematic bias (say, +0.1g per step) becomes a large drift over 8 hours (16 patches × 0.1 = 1.6g accumulated error in the integral). Absolute values don't have this problem — each prediction is anchored independently.`

I am concerned about whether the 30 minute patch can successfully capture the sometimes whacky dynamics of BG.

`If you find during experiments that 30-minute patches lose too much, you can drop to 15-minute patches (3 steps, patch size 3). This doubles the sequence length (from ~720 to ~1440 patches for 15 days) but is still manageable for a small model. Start with 30-minute patches and downshift only if needed.`

I propose that we use the Muon optimizer. The latest YOLO model uses it, and it seems to be getting popular.

`Muon's learning rate schedule interacts differently than Adam's. You'll likely need a higher base learning rate with Muon (the orthogonalization normalizes update magnitudes). Start with lr=0.02 for the Muon group and lr=3e-4 for the Adam group, and tune from there.`

Any more questions?

`What is the masking strategy? Options include randomly revealing 0–3 channels per future patch with uniform probability, revealing channels in blocks (all of channel X is known for patches t+1 to t+4, but channel Y is unknown), or always revealing all channels for the nearest patches and fewer for distant ones. The block strategy seems most realistic — when a user plans a meal, they specify the entire carb curve, not random 30-minute fragments. `

The block strategy sounds better. By the way, let's have two separate channels for input BG: one that is absolute, and one that is the delta. Everything else is absolute. What do you think?

`This is clean and well-motivated. The model sees BG = 120 (absolute) and ΔBG = -15 over the last patch (trending down). Both are informative and non-redundant. The absolute value anchors the physiological context (120 is in range, 250 is not), and the delta captures momentum (falling fast vs. stable).`

Can you elaborate more on the block masking?

`For each training sample, with probability p_mask (say 0.3), we activate future masking. When active:`

`Pick 1–3 output channels randomly. For each selected channel, pick a contiguous block of future patches (say 2–8 patches, i.e. 1–4 hours). Reveal those channel values as known inputs for those patches. The model must predict the remaining channels and the unrevealed portions of the selected channels.`

`This teaches the model scenarios like: "the patient has told me they plan to eat these carbs over the next 2 hours — what will their IS and insulin look like?".`

`With probability 1 - p_mask, no future channels are revealed, and the model predicts everything from context alone. This is the standard forecasting mode.`

I see. By the way, should we also normalize after attention/FFN?

`If you see training instability (loss spikes, NaN gradients), adding post-norm is a quick fix. But at 10 layers with bf16, you probably won't need it. We could also add a final RMSNorm before the output head (after the last transformer block), which is standard and helps — Qwen does this.`

Let's remove dropout. We can generate as many distinct inputs as we want.

`With on-the-fly generation from the simulator, every training batch is unique. You're effectively training on infinite data with no repetition. Dropout's purpose is regularization against overfitting, and you can't overfit data you never see twice. Removing it also speeds up training slightly and makes the model deterministic during training (useful for debugging).`

Anything else?

`I think we're ready. Let me write the full architecture specification. I'll cover every component, dimension, and design choice so we can review it together before coding.`

