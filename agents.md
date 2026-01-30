Instructions for the agent:
======
If you ever have any questions or something is not 100% clear, ask me BEFORE changing any code. Ask until you are completely clear.
======
When it comes to HTML and CSS, avoid redfining anything we don't have to. For example I don't want to see CSS such as "div.header h1" -  I much prefer to just style the h1 as that in general. Same for all headings, and even paragraphs and everythign else. Keep CSS styling as broad and generalised as possible. A h4 should always look like a h4, everywhere and by doing that we keep better UI consistency, which is important to me, and code clarity, which is even more important to me.
======
Remember to include comments in your code.
======
I do not want to use any CSS frameworks such as tailwind or similar. Just pure and raw please.
======
In this tool we ideally only want to perform calculations when we upload and process new data. Everything possible should be calculated at that point, and stored. Then when we need to display this info we don't recalculate it we just take it from the storage. The one known exception to this is when the user changes the config of an experiment, at that point we need to change the config and recalculate the data.
======
Any time we add new information into the local storage that we didn't use before, strive to ensure that the code remains backwards compatible with users who have old versions of the storage on their machines. The VERY STRONG preference is to do this WITHOUT forking into a new version. I don't want to see any logic that needs to check the storage version and then changes behaviour. This is bloat. If a change really NEEDS this fork to happen, and truly cannot work any other way, then warn me about it first, explain why this is the case, and ask me to confirm.
======
Start every single reply with "Ahoy Matey!"
