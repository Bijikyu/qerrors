No part of the qerrors module should itself call qerrors on an error in qerros as that 
would cause an infinite loop. 
Unlike other code, the code in qerrors does not need to log the start of the function 
that it is running, and it also doesn't need to log that it has finished running 
(if it does already though, leave it alone).
None of the code in qerrors needs to check for offline mode via the CODEX environment 
variable, as most apps alreay skip qerrors in offline mode.
Unlike most apps, as an npm mdule qerrors is exempt from including its node_modules as 
part of commits, and so these should be gitignored.