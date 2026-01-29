+++
date = '2026-01-28T21:56:49+04:00'
draft = true
title = 'Are you living in an encrypted simulation?'
math = true
toc = true
tags = ["cryptography", "machine-learning", "vulkan"]
showTags = true
readTime = true
+++

<!--more-->

## The Hall of Egress

![Hall of Egress](/img/hall_of_egress.webp#center "Image Credit: Adventure Time / Cartoon Network")

There is an [episode](https://www.youtube.com/watch?v=tg7ovSctPX8) of Adventure Time where the protagonist (Finn the Human)
and his brother (Jake the Dog) find a mysterious dungeon---like an "ancient secret temple" (Finn's words, not mine).
Finn enters first, but inadvertently steps on a trap, which seals the entrance shut. He is trapped.

Undeterred, he proceeds to explore the place, only to fall (what looks to be) two stories down, seemingly unharmed.
This is where things get interesting. He walks into a room at the center of which lies a statue of an upside-down
snowman, surrounded by two pillars with red glowing eyes. At the end of the room is a large door---also closed---with the
following letters etched on its surface: "HALL OF EGRESS".

![Egress Meaning](/img/egress_word_meaning.png#center "Merriam-Webster's definition of **egress**")

Despite how much force he applies, the door doesn't bulge (and Finn has enough strength to punch
a [vampire](https://www.youtube.com/watch?v=qXXcA68ZIlE) ten times his size). But then, through sheer luck, he has an
epiphany: the door disappears once he **closes his eyes**.

There are other interesting problems where the solution is often to "blindfold" ourselves. For example, take
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
We would like for both of them to evolve. Alas, the code that invokes evolution is duplicated. We have
to store the organisms of different grades separately and call their `evolve` methods in their own respective loops.
Worse, what if we discover some other life form that doesn't fit neatly in the above dichotomy?
More duplication!

C++'s solution to this is [polymorphism](https://en.wikipedia.org/wiki/Polymorphism_(computer_science)):

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
for (Grade* g : organisms) {
    g->evolve();
}
```

Our new loop is **blind**---in the sense that it no longer knows which grade of organism it
operates on. When a new grade is discovered, the source code need not be duplicated.

Polymorphism has a [closed-form](https://en.wikipedia.org/wiki/Closed-form_expression) solution.
In the case of C++, each class maintains a table of
pointers to functions, and each instance of a class contains a pointer to the appropriate table.
This way, when the `evolve` function is called, the instructions become:

```basic
FETCH       VTBL
LOOKUP      FUNCTION "evolve" in VTBL
CALL        evolve
```

We call this [dynamic dispatch](https://en.wikipedia.org/wiki/Dynamic_dispatch). Although powerful,
one must be careful not to overuse it. There are two indirections here:

1. We dereference the pointer to the function table.
2. Then, we dereference the address of the function to begin executing its instructions.

Dynamic dispatch introduces sequential dependency: the CPU can't know in advance which function
to call without first looking up the address of the function stored in the table---so
if the function (by which I mean the machine instructions that make up the function) returned by the
`LOOKUP` instruction isn't already cached, the pipeline stalls. Like the CPU,
the compiler also can't determine which function will be called, so
[inlining](https://en.wikipedia.org/wiki/Inline_expansion) is hard.

Not all problems have closed-form solutions. What if we wanted to calculate the value of $\pi$?
There is no function with a fixed set of instructions that can calculate $\pi$, but there exist
functions each with a fixed set of instructions such that when computed **iteratively**, can
obtain better and better approximations of $\pi$. Here's
[Ramanujan's](https://en.wikipedia.org/wiki/Srinivasa_Ramanujan) solution to this problem:

$$
\frac{1}{\pi} = \frac{2\sqrt{2}}{9801} \sum_{k=0}^{\infty} \frac{(4k)!(1103+26390k)}{(k!)^4 396^{4k}}
$$

We don't need to be as smart as Ramanujan to come up with our own approximation. Below I outline
another possible solution that uses random sampling. First, let us draw a unit circle inscribed within a square:

![Circle inscribed within a square](img/circle.png#center)

It is not perfectly inscribed because I drew this quickly using [KolourPaint](https://apps.kde.org/kolourpaint/),
but you get the idea. Now suppose that we start randomly putting points inside the square:

![Circle inscribed within a square with points](img/circle_with_points.png#center)

What's the probability of a point landing within a circle? Well, since the radius of the circle is 1, the area of
the square is 4, and the area of the circle is $\pi$. So the probability of a point landing in the circle is
$\pi / 4$. We can exploit this to write a program that approximates the digits of $\pi$:

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

Here we begin with the number of iterations set to 1, and then increase its magnitude up to 7 orders.
Because we know the probability of a point being inside the circle is $\pi / 4$, all we need to do is
generate a bunch of points and then divide the number of points inside the circle by the total number of
points. We then multiply this number (defined as `k`) with 4 to get the approximation of $\pi$.

This outputs:

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

The first time our algorithm is run, it just happened so that our point landed in the circle, causing
`k` to equal 1.0. If you run this code, there is about 21.46% chance that you will get 0.0 for the first
value. But that doesn't matter, because as the number of iterations is increased, everyone running this
code will get closer and closer to the true value of $\pi$---well, at least to the extent that the machine is capable of.
Floating-point numbers have finite precision, and at some point errors accumulated through repeated calculations
will start to work against us.

At the time of writing this article humanity has computed up to [314 trillion](https://en.wikipedia.org/wiki/Chronology_of_computation_of_pi)
digits of $\pi$, but the point is that none of these approximations is the **true** value of $\pi$, because the actual value is an infinite sequence
of non-repeating digits.

Below is the graph of our progress:

![PI History](/img/pi_singularity.png "By Znerol1986, licensed under CC BY-SA 4.0, colors are inverted")

We have attained $\pi$-singularity before the more general [technological singularity](https://en.wikipedia.org/wiki/Technological_singularity).

This problem is interesting because although we don't know all the digits of $\pi$,
we are able to come up with instructions that take us there iteratively---**and** we are confident that these instructions work,
lest we would have needed to compare the results of our algorithm with the true value of $\pi$, which we don't have access to.

But what happens when we **don't** know what the solution space looks like?

## Bostrom's Demon
