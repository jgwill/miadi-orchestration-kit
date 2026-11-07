echo "Updating APT..." && sudo apt update &>/dev/null && echo "Listing installed Miadi packages..." 

if [ "$1" == "--raw" ]; then
    apt list|grep miadi
else
apt list|grep miadi|tr '\/' ' '|awk '{print $1}'
fi


