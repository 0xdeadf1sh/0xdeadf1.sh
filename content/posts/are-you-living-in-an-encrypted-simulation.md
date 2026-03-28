+++
date = '2026-03-01T21:56:49+04:00'
draft = true
title = 'Are You Living In An Encrypted Simulation?'
math = true
toc = true
tags = ["cryptography", "machine-learning", "graphics-programming", "systems-engineering"]
showTags = true
readTime = true
autoNumber = true
+++

<!--more-->

## The Hall of Egress

![Hall of Egress](/img/hall_of_egress.webp#center "Image Credit: Adventure Time / Cartoon Network")

### Finn the Human

There is an [episode](https://www.youtube.com/watch?v=tg7ovSctPX8) of Adventure Time where the protagonist (Finn the Human)
and his brother (Jake the Dog) find a mysterious dungeon---like an "ancient secret temple" (Finn's words, not mine).
Finn enters first, but inadvertently steps on a trap, which seals the entrance shut. He is trapped.

Undeterred, he proceeds to explore the place, only to fall (what looks to be) two stories down a crevice, seemingly unharmed.
This is where things get interesting. He walks into a room with a statue of an upside-down
snowman---surrounded by two pillars with red glowing eyes. At the end of the room is a large door with the
following letters etched on its surface: "HALL OF EGRESS".

![Egress Meaning](/img/egress_word_meaning.png#center "Merriam-Webster's definition of **egress**")

Alas, despite his many attempts, the door doesn't bulge (and Finn has enough strength to punch
a [vampire](https://www.youtube.com/watch?v=qXXcA68ZIlE) more than ten times his size). But then, through sheer luck, he discovers something peculiar: the door disappears once he **closes his eyes**.

### I Can Haz Many Forms?

There are other interesting problems where one of the solutions is to "blindfold" oneself. For example, take
the following piece of code:

```cpp
class Prokaryotic {
public:
    void evolve() {
        // develop new chemical pathways
    }
};

class Eukaryotic {
public:
    void evolve() {
        // develop new body parts
    }
};

eastl::vector<Prokaryotic> prokaryotes{};
for (Prokaryotic& p : prokaryotes) {
    p.evolve();
}

eastl::vector<Eukaryotic> eukaryotes{};
for (Eukaryotic& e : eukaryotes) {
    e.evolve();
}
```

> Note: I am using [EA's standard library](https://github.com/electronicarts/EASTL),
which isn't too different from C++'s standard library. I prefer `EASTL` to `std` because
of its emphasis on performance and some important data structures that it provides (e.g. intrusive lists).

In this contrived example we have two grades of organisms: `Prokaryotic` and `Eukaryotic`.
We would like for both of them to evolve. Unfortunately, the code that invokes evolution is duplicated. We have
to store the organisms of different grades separately and call their `evolve` methods in their own respective loops.
Worse, what if we discover some other life form that doesn't fit neatly in the above dichotomy?
More duplication! We'd rather prefer not to [repeat ourselves](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself).

Luckily for us, C++ offers [polymorphism](https://en.wikipedia.org/wiki/Polymorphism_(computer_science)):

```cpp
class Grade {
public:
    virtual void evolve() = 0;
};

class Prokaryotic : public Grade {
public:
    virtual void evolve() override {
        // develop new chemical pathways
    }
};

class Eukaryotic : public Grade {
public:
    virtual void evolve() override {
        // develop new body parts
    }
};

eastl::vector<Grade*> organisms{};
for (Grade* organism : organisms) {
    organism->evolve();
}
```

Our new loop is **blind**---in the sense that it no longer knows which grade of organism it
operates on. When a new grade is discovered, the source code need not be duplicated.

Polymorphism is a [closed-form](https://en.wikipedia.org/wiki/Closed-form_expression) solution.
In the case of C++, each class maintains a table of
pointers to functions, and each instance of a class contains a pointer to that table.
This way, when the `evolve` function is called, the instructions become:

```basic
FETCH       VTBL                            ; fetch the virtual function table
LOOKUP      FUNCTION "evolve" in VTBL       ; look up the location of "evolve"
CALL        evolve                          ; invoke the procedure
```

We call this [dynamic dispatch](https://en.wikipedia.org/wiki/Dynamic_dispatch). Although powerful,
one should be careful not to overuse it. There are two indirections here:

1. We dereference the pointer to the virtual function table.
2. Then, we dereference the address of the function to begin executing its instructions.

> Uncle Bob ain't gonna like this.

Dynamic dispatch introduces sequential dependency: the CPU can't know in advance which function
to call without first looking up the address of the function stored in the table---so
if the function (by which I mean the machine instructions that make up the function) returned by the
`LOOKUP` instruction isn't already cached, the pipeline stalls. Like the CPU,
the compiler also can't determine which function will be called, so
[inlining](https://en.wikipedia.org/wiki/Inline_expansion) is hard.

Dynamic dispatch is `O(k)` where the `k` is constant. But that `k` is often large enough to incite spite in the hearts
of many programmers (including mine).

### Throwing Dice in Monte Carlo

Not all problems have closed-form solutions. What if we wanted to calculate the value of $\pi$?
There is no function with a finite set of instructions that can compute $\pi$, but there **does** exist
a finite set of instructions such that when applied **iteratively**, can
obtain better and better approximations of $\pi$. Here's
[Ramanujan's](https://en.wikipedia.org/wiki/Srinivasa_Ramanujan) solution to this problem:

$$
\frac{1}{\pi} = \frac{2\sqrt{2}}{9801} \sum_{k=0}^{\infty} \frac{(4k)!(1103+26390k)}{(k!)^4 396^{4k}}
$$

We don't need to be as smart as Ramanujan to come up with our own approximation. Below I outline
another possible solution that uses random sampling. First, let us draw a unit circle inscribed within a square:

![Circle inscribed within a square](img/circle.png#center)

It is not perfectly inscribed because I drew this quickly using [KolourPaint](https://apps.kde.org/kolourpaint/),
but you get the idea. Now suppose that we start putting random points inside the square:

![Circle inscribed within a square with points](img/circle_with_points.png#center)

What's the probability of a point landing within a circle? Well, since the radius of the circle is 1, the area of
the square is 4, and the area of the circle is $\pi$. So, the probability of a point landing in the circle is
$\pi / 4$. We can exploit this to write a program that approximates the value of $\pi$:

```cpp
#include <random>
#include <print>
#include <cstdint>
#include <cmath>

int main()
{
    std::random_device rd{};
    std::uniform_real_distribution dist(0.0f, 1.0f);

    for (int32_t iterationCount{ 1 }; iterationCount <= 10'000'000; iterationCount *= 10) {

        int32_t pointsInCircleCount{};

        for (int32_t i{}; i < iterationCount; ++i) {
            float x{ dist(rd) };
            float y{ dist(rd) };

            if (sqrtf(x * x + y * y) <= 1.0f) {
                ++pointsInCircleCount;        
            }
        }

        float k{ static_cast<float>(pointsInCircleCount) / static_cast<float>(iterationCount) };
        float pi{ k * 4 };

        std::println("The value of pi is {:.9f}\t\t(iterations = {})", pi, iterationCount);
    }

    return 0;
}
```

Here we begin with the number of iterations set to 1, and then increase its magnitude by up to 7 orders.
Because we know the probability of a point being inside the circle is $\pi / 4$, all we need to do is
generate a bunch of points and then divide the number of points inside the circle by the total number of
points generated. We then multiply this number (defined as `k`) with 4 to get the approximate value of $\pi$:

```bash
The value of pi is 4.000000000		(iterations = 1)
The value of pi is 2.799999952		(iterations = 10)
The value of pi is 3.319999933		(iterations = 100)
The value of pi is 3.016000032		(iterations = 1000)
The value of pi is 3.165999889		(iterations = 10000)
The value of pi is 3.138439894		(iterations = 100000)
The value of pi is 3.139247894		(iterations = 1000000)
The value of pi is 3.141742468		(iterations = 10000000)
```

The first time our algorithm was run, it just so happened that our point landed in the circle, causing
`k` to equal 1.0. If you run this code, there is about 21.46% chance that you will get 0.0 for the first
value. But that doesn't matter, because as the number of iterations is increased, everyone running this
code will get closer and closer to the true value of $\pi$---well, at least to the extent that the machine is capable of.
Floating-point numbers have finite precision, and at some point (wink wink) they will no longer be able to represent a signed 32-bit integer accurately. Also, there are [much better algorithms](https://en.wikipedia.org/wiki/Category:Pi_algorithms) out there.

At the time of writing this article, humanity has computed up to [314 trillion](https://en.wikipedia.org/wiki/Chronology_of_computation_of_pi)
digits of $\pi$, but none of these approximations is the **true** value of $\pi$, because the actual value is an infinite sequence
of non-repeating digits. Alas, we cannot express infinitudes in a universe of finitudes.

![PI History](/img/pi_singularity.png "By Znerol1986, licensed under CC BY-SA 4.0, colors are inverted")

We are living in a $\pi$-singularity.

This problem is interesting because although we don't know all the digits of $\pi$,
we are able to come up with instructions that take us there iteratively---**and** we are confident that these instructions work,
lest we would need to compare the results of our algorithm with the true value of $\pi$, which we don't have access to (and never will). One can say that there is no solution here, since---by definition---no number of iterations of
even the fastest-converging algorithm will get us to the true value of $\pi$. So we are **blind** w.r.t. the [Platonic](https://en.wikipedia.org/wiki/Hyperuranion) $\pi$---we will never "see" its true value.

But what happens when there **is** a non-Platonic solution to a problem that the lowly beings like you
and I can reach, but don't know how? That is, what if we are **blind** w.r.t. the **path** to the solution?

We will use a different strategy: instead of climbing the ever-taller
stairs to heaven, we shall descend down to [Hades](https://en.wikipedia.org/wiki/Hades).

### A Slippery Slope

Eyes closed, Finn enters the maze-like tunnel. He uses his hands to "feel" his surroundings before making each step.
His first attempt almost gets him killed.

Fortunately, Finn can "reset" the simulation by opening his eyes. This puts him back where he started---he
doesn't need to walk all the way back. And his memory remains intact. So he grabs a pen and draws a map,
marking the place where he almost died:

![Finn's map](./img/finn_map.png#center "Image Credit: Adventure Time / Cartoon Network")

Finn **knows** that there is a solution---because of the word "EGRESS". But he doesn't know how to **reach**
that solution, so he must try multiple times. **The paths that lead to spikes are marked.** This is the crucial part.
Finn reasons that his knowledge of where the spikes are (i.e. the erroneous paths) will guide him toward the exit.
Do you think that his reasoning is sound?

The idea of using the error of the previous attempt as a guide toward the correct solution
emerges in many problems. Consider the following plot of exoplanets where the horizontal axis denotes
planetary mass and the vertical axis is the planetary radius (the plot also shows solar masses on the right,
but to keep things simple we will simply ignore that):

![Exoplanets plotted](./img/exoplanets.jpeg#center "~3500 exoplanets plotted with respect to their mass and radius")

This is from a [reddit post](https://www.reddit.com/r/dataisbeautiful/comments/1fnvmvh/oc_i_plotted_data_from_3500_exoplanets_comparing/) a few years ago. I inverted the colors so that your eyes don't bleed when looking at it.

What if I wanted to plot a straight line that could reveal the relationship between planetary mass and radius?
Such that when I discovered a new exoplanet of a given mass, I could also predict its radius?

A straight line can be defined as a function $f(x)$ such that:

$$f(x) = mx + b$$

where $m$ is the slope of the line and $b$ is the y-intercept. Therefore, we need to come up with values for $m$ and
$b$ that would most accurately predict the radius given mass.

First, we initialize $m$ and $b$ with random numbers. This is akin to Finn taking some random path through the maze for the first time.
Say $m = 0.0$ and $b = 1.0$. To make things easier to follow, I created a table that maps the mass of some planets
to their radii:

> Note: I didn't really extract the values from the plot---I simply "eyeballed" them. Also,
the values are powers of $10$, e.g. $0.01$ means $10^{0.01}$.

| Mass | Radius |
| ---- | ------ |
| 0.01 | 0.02   |
| 0.60 | 0.10   |
| 1.10 | 0.60   |
| 2.30 | 1.10   |
| 2.50 | 1.20   |

Let us begin with the first row. Substituting $0.0$ for $m$ and $1.0$ for $b$, we have:

$$f(0.01) = 0.0 * 0.01 + 1.0 = 1.0$$

Oops! Our line predicted a value of $1.0$ for the radius (given a mass of $0.01$), when it should have been $0.02$! 
We fell to a spike trap!

What do we do? First, we need a way of quantifying the error. There are multiple ways of doing this.
For example, we could simply subtract the predicted value ($1.0$) from the observed value ($0.02$):

$$\epsilon = 1.0 - 0.02 = 0.98$$

where $\epsilon$ is the error. While that is certainly doable, this way of computing the error makes
the proceeding calculations harder. To understand why, let me introduce a different way of computing the error:

$$\epsilon = (v_{predicted} - v_{observed})^2$$

This is called **squared error loss**. It belongs to a class of functions called **loss functions**. The
purpose of a loss function is to quantify the accuracy of some predictor (which, in our case, is a straight line).
If we now apply this function for every value in the table above, we get this:

| Mass | Actual Radius | Predicted Radius | Error ($\epsilon$) |
| ---- | ------------- | ---------------- | ------------------ |
| 0.01 | 0.02          | 1.0              | 0.9604             |
| 0.60 | 0.10          | 1.0              | 0.8100             |
| 1.10 | 0.60          | 1.0              | 0.1600             |
| 2.30 | 1.10          | 1.0              | 0.0100             |
| 2.50 | 1.20          | 1.0              | 0.0400             |

Our line predicts the same radius for all masses, since $m = 0.0$. But this needs to change. We need to nudge the
value of $m$ (and $b$) in order to minimize the error. Our assumption is that by minimizing the error, our line
will become more accurate in predicting planetary radii.

Remember that our predictor is a straight line:

$$f(x) = mx + b$$

So another way of writing the loss function is:

$$\epsilon = (mx + b - v_{observed})^2$$

I simply replaced $v_{predicted}$ with the equation of the line. In order to minimize the error ($\epsilon$),
we need to minimize the expression $(mx + b - v_{observed})^2$.

You might be tempted to think that $\epsilon$ is a quadratic function; maybe you think:

$$\epsilon(x) = (mx + b - v_{observed})^2$$

But this is not the case! $x$ is **not** the independent variable here---$x$ is the mass of the planet, which
we cannot change. Nor can we change the radius ($v_{observed}$), so the only variables remaining are $m$ and $b$.

Our loss function is a [paraboloid](https://en.wikipedia.org/wiki/Paraboloid) defined in 3D space:

$$\epsilon(m, b) = (mx + b - v_{observed})^2$$

Here's what it looks like:

![Paraboloid](./img/paraboloid.png#center "Paraboloid")

Imagine yourself standing somewhere inside that shape. Also imagine that, like Finn, you are blindfolded,
and removing the blindfold puts you back where you started.
How do you determine which direction to walk in order to go down
toward the lowest point? To the underworld---where Orpheus went to rescue his lover?

> First, let's understand why we need to **descend** to the lowest point of the paraboloid.
Remember that, in order to minimize loss,
we need to minimize the expression $(mx + b - v_{observed})^2$. That means for all $x$ and $v_{observed}$,
we must figure out which values of $m$ and $b$ will "place" us at the bottom---or, at least, very close to it. For it is the lowest point in the paraboloid that
will produce the least error. Naturally, it beckons us to descend toward it.
If you were to ascend instead, then your loss values would become very high, and your predictions very wrong!

Finn used his hands to feel the walls as he walked through the maze. We don't have walls. Instead, we have a
curved surface. So, we can use our feet to feel the ground and find out where we should step. Mathematically,
this is equivalent to moving in the **opposite** direction of the **gradient** of the loss function.

The gradient can be found by computing the derivatives of the loss function with respect to its parameters---which are
$m$ and $b$. To find these derivatives we can use the [chain rule](https://en.wikipedia.org/wiki/Chain_rule).

For example, the derivative of $\epsilon(m, b)$ with respect to $m$ is:

$$2x(mx + b - v_{observed})$$

First, we find the derivative of $(mx + b - v_{observed})^2$, which is $2(mx + b - v_{observed})$. Then,
using the chain rule, we multiply this with the derivative of $mx$, which is $x$.

Using the same method, we then find the derivative of $\epsilon(m, b)$ with respect to $b$, which is:

$$2(mx + b - v_{observed})$$

Therefore, the **gradient** of $\epsilon(m, b)$ is defined as:

$$
\nabla{\epsilon} =
\begin{bmatrix}
2x(mx + b - v_{observed} \\\\
2(mx + b - v_{observed}) \\\\
\end{bmatrix}
$$

Formally:

$$
\nabla{\epsilon} =
\begin{bmatrix}
\frac{\partial}{\partial m}\epsilon \\\\
                                    \\\\
\frac{\partial}{\partial b}\epsilon \\\\
\end{bmatrix}
$$

> Note: We chose the **squared error loss** function, because, for one it is easily differentiable, but also because it helps
us penalize errors proportionally. That is, it produces large errors when we are "far away" from the solution, but
much smaller errors as we get "closer".

Now let's actually calculate the values of $\frac{\partial}{\partial m}$ and $\frac{\partial}{\partial b}$
for each of our planets:

| Mass | Actual Radius | Predicted Radius | Error ($\epsilon$) | $\frac{\partial}{\partial m}$ | $\frac{\partial}{\partial b}$ |
| ---- | ------------- | ---------------- | ------------------ | ----------------------------- | ----------------- |
| 0.01 | 0.02          | 1.0              | 0.9604             | 0.0196                        | 1.9600            |
| 0.60 | 0.10          | 1.0              | 0.8100             | 1.0800                        | 1.8000            |
| 1.10 | 0.60          | 1.0              | 0.1600             | 0.8800                        | 0.8000            |
| 2.30 | 1.10          | 1.0              | 0.0100             | -0.4600                       | -0.2000           |
| 2.50 | 1.20          | 1.0              | 0.0400             | -1.0000                       | -0.4000           |

We need to make sure that our steps aren't too large---that is, we don't end up jumping all over the place. To fix
this, we can introduce a parameter called the **learning rate**, which is a small number that we multiply with our
derivatives before modifying $b$ and $m$. For this example, we set the learning rate to $0.1$.

> Note: The name "learning rate" is a misnomer. It should have been called "jumping rate", because that's what it
essentially does. Setting the learning rate to a high value won't actually help the predictor learn faster, it will
simply force it to make bigger jumps. This can actually hurt us, because we may end up jumping **over** the minimum
point of the parabaloid.

Now let's find the average of our derivatives $\frac{\partial}{\partial m}$ and $\frac{\partial}{\partial b}$:

$$(0.0196 + 1.0800 + 0.8800 - 0.4600 - 1.0000) / 5 = 0.10392$$
$$(1.9600 + 1.8000 + 0.8000 - 0.2000 - 0.4000) / 5 = 0.79200$$

We multiply these values with our learning rate:

$$0.10392 * 0.1 = 0.010392$$
$$0.79200 * 0.1 = 0.079200$$

Then we subtract these values from $m$ and $b$, respectively:

$$m' = m - 0.010392 = 0.0 - 0.010392 = -0.010392$$
$$b' = b - 0.079200 = 1.0 - 0.079200 = 0.920800$$

And now that we have nudged $m$ and $b$ a bit, let's see whether this new predictor is actually better:

| Mass | Actual Radius | Predicted Radius | Error ($\epsilon$) |
| ---- | ------------- | ---------------- | ------------------ |
| 0.01 | 0.02          | 0.92069          | 0.811253           |
| 0.60 | 0.10          | 0.91456          | 0.663516           |
| 1.10 | 0.60          | 0.90937          | 0.095710           |
| 2.30 | 1.10          | 0.89689          | 0.041250           |
| 2.50 | 1.20          | 0.89482          | 0.093135           |

Previously, our average error was

$$\frac{0.9604 + 0.8100 + 0.1600 + 0.0100 + 0.0400}{5} = 0.39608$$

Our new average error is

$$\frac{0.811253 + 0.663516 + 0.095710 + 0.041250 + 0.093135}{5} = 0.340973$$

We have decreased the error!

What we did above is called **gradient descent**, and it is (currently) the dominant technique by which machines
learn. It is the reason why those data centers consume so much electricity and water, and it is method through which
we imparted the knowledge of language to rocks. The number of parameters may differ, the way the learning rate is
specified may differ, but the technique is more or less the same:

1. Initialize the parameters of the model with random-ish values
2. Feed the model with some numbers---producing errors.
3. Use the errors to nudge the parameters of the model.
4. Profit! (or loss, in [OpenAI's case](https://finance.yahoo.com/news/openais-own-forecast-predicts-14-150445813.html) anyway)

Applied iteratively, **gradient descent** can help us find a straight line with the highest "predictive power"---that is,
a line that can predict the radius of a planet given its mass with high accuracy (or, in OpenAI's case, a model
that can [solve hard math problems](https://www.computerworld.com/article/4141889/gpt-5-4-solves-previously-unsolved-math-problem-with-help-from-long-forgotten-human-research.html)).

> Note: There is another version of gradient descent called **stochastic gradient descent**, where, instead of
averaging the error, we compute the error for each data point and then modify the parameters of the model accordingly.
I won't explain the details here, you may surf the Internet to find out more.

Gradient descent helped us move closer to the solution even though we were blind w.r.t. the **path** to the solution.
That is, we didn't know what the true path looked like, but we were able to make small steps and thus carved our own path.
But what about Finn? Let's see how he is doing:

![Finn Lost](./img/finn_lost.png#center "Image Credit: Adventure Time / Cartoon Network")

Hmm, he doesn't look too good. Unfortunately gradient descent didn't help him. But why?

### The Enigma Machine

## The Matrix
