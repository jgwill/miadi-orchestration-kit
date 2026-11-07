echo "Updating APT..." && sudo apt update &>/dev/null && echo "Listing installed Miadi packages..." 
apt list|grep miadi|tr '\/' ' '|awk '{print $1}'
